import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Paper, Stepper, Step, StepLabel, 
  Button, Box, Grid, Card, CardContent, Checkbox,
  List, ListItem, ListItemText, ListItemIcon, CircularProgress,
  Alert, TextField, FormControl, InputLabel, Select, MenuItem, 
  FormControlLabel, Stack, Divider, Chip, LinearProgress
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { 
  CloudUpload as UploadIcon, 
  Search as ScanIcon,
  Event as CalendarIcon,
  Description as DocumentIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Storage as VaultIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';

// Types
interface Contract {
  id: string;
  name: string;
  path: string;
  selected: boolean;
  size: number;
  lastModified: string;
  scanned: boolean;
  renewalDate?: string;
  amount?: number;
  parties?: string[];
  sourceType?: 'gmail' | 'drive';
  sourceLocation?: string;
}

interface Keyword {
  id?: number;
  text: string;
}

interface SearchParams {
  keywords: Keyword[];
  startDate: Date | null;
  endDate: Date | null;
  service: 'MAIL' | 'DRIVE' | 'GROUPS' | 'HANGOUTS_CHAT' | 'ALL';
  dataSource: 'ALL_DATA' | 'HELD_DATA' | 'UNPROCESSED_DATA';
  entityType: 'ALL_ACCOUNTS' | 'SPECIFIC_ACCOUNTS';
  specificAccounts?: string[];
  timeZone: string;
  excludeDrafts: boolean;
  includeAllMatches: boolean;
}

interface VaultSearchStatus {
  id: number;
  matterId: string;
  status: 'CREATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  description?: string;
  statusCheckFailCount?: number;
}

const UploadContracts: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [workspaceEmail, setWorkspaceEmail] = useState('');
  
  // Keyword state
  const [searchParams, setSearchParams] = useState<SearchParams>({
    keywords: [],
    startDate: null,
    endDate: null,
    service: 'MAIL',
    dataSource: 'ALL_DATA',
    entityType: 'ALL_ACCOUNTS',
    specificAccounts: [],
    timeZone: 'UTC',
    excludeDrafts: true,
    includeAllMatches: false
  });
  const [newKeyword, setNewKeyword] = useState('');
  
  // Vault search state
  const [vaultSearch, setVaultSearch] = useState<VaultSearchStatus | null>(null);
  const [searchDescription, setSearchDescription] = useState('');
  const [statusPollingInterval, setStatusPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Add a new state for OAuth URL
  const [oauthUrl, setOauthUrl] = useState<string>('');

  // Add new state for auth method
  const [authMethod, setAuthMethod] = useState<'oauth' | 'service_account'>('oauth');

  // Track if connection was just established
  const [justConnected, setJustConnected] = useState(false);

  // Add userEmail state to store the connected user's email
  const [userEmail, setUserEmail] = useState<string>('');
  
  // Add googleEmail state specifically for the connected Google account
  const [googleEmail, setGoogleEmail] = useState<string>('');

  // Add emailLoading state
  const [emailLoading, setEmailLoading] = useState(false);

  const steps = ['Connect Google Workspace', 'Set Search Criteria', 'Wait for Results', 'Select Contracts', 'Review & Upload'];

  // Enhanced fetchGoogleEmail function with fallbacks and retry logic
  const fetchGoogleEmail = async () => {
    try {
      setEmailLoading(true);
      console.log('Attempting to fetch Gmail account email...');
      
      // Try multiple endpoints in sequence to get the email
      // 1. First try auth-status endpoint which should have the most recent value
      try {
        console.log('Trying auth-status endpoint...');
        const authStatusResponse = await axios.get('/api/google/auth-status');
        console.log('Auth status response:', authStatusResponse.data);
        
        if (authStatusResponse.data && authStatusResponse.data.email) {
          console.log('Found email in auth-status endpoint:', authStatusResponse.data.email);
          setGoogleEmail(authStatusResponse.data.email);
          setGoogleConnected(true);
          return;
        }
      } catch (err) {
        console.error('Error fetching from auth-status endpoint:', err);
      }
      
      // 2. Try Gmail profile endpoint (most accurate)
      try {
        console.log('Trying Gmail profile endpoint...');
        const profileResponse = await axios.get('/api/google/gmail/profile');
        console.log('Gmail profile response:', profileResponse.data);
        
        if (profileResponse.data && profileResponse.data.emailAddress) {
          console.log('Found email in Gmail profile:', profileResponse.data.emailAddress);
          setGoogleEmail(profileResponse.data.emailAddress);
          setGoogleConnected(true);
          return;
        }
      } catch (profileErr) {
        console.error('Error fetching Gmail profile:', profileErr);
      }
      
      // 3. Try Google status endpoint 
      try {
        console.log('Trying Google status endpoint...');
        const statusResponse = await axios.get('/api/google/status');
        console.log('Google status response:', statusResponse.data);
        
        if (statusResponse.data && statusResponse.data.workspaceEmail) {
          console.log('Found email in status endpoint:', statusResponse.data.workspaceEmail);
          setGoogleEmail(statusResponse.data.workspaceEmail);
          setGoogleConnected(statusResponse.data.connected);
          return;
        }
      } catch (err) {
        console.error('Error fetching from status endpoint:', err);
      }
      
      // 4. Try test-connection as last resort
      try {
        console.log('Trying test-connection endpoint as last resort...');
        const testResponse = await axios.get('/api/google/test-connection');
        console.log('Test connection response:', testResponse.data);
        
        if (testResponse.data) {
          const email = 
            testResponse.data.workspaceEmail || 
            (testResponse.data.services?.gmail?.emailAddress) ||
            null;
          
          if (email) {
            console.log('Found email in test-connection endpoint:', email);
            setGoogleEmail(email);
            setGoogleConnected(true);
            return;
          }
        }
      } catch (testErr) {
        console.error('Error in test-connection endpoint:', testErr);
      }
      
      // If we reach here, we couldn't find the email
      console.warn('Could not retrieve Google account email from any endpoint');
      
      // Even if we couldn't find the email, still mark as connected if we have a refresh token
      try {
        const statusResponse = await axios.get('/api/google/status');
        if (statusResponse.data && statusResponse.data.connected) {
          console.log('Setting googleConnected=true despite not finding email');
          setGoogleConnected(true);
        }
      } catch (finalErr) {
        console.error('Error in final connection check:', finalErr);
      }
      
    } catch (err) {
      console.error('Error fetching Google account email:', err);
    } finally {
      setEmailLoading(false);
    }
  };

  // Check if Google credentials are available
  useEffect(() => {
    const checkGoogleCredentials = async () => {
      try {
        const response = await axios.get('/api/google/status');
        console.log('Google credentials status:', response.data);
        
        if (response.data.connected) {
          console.log('Setting googleConnected = true');
          setGoogleConnected(true);
          
          console.log('Google is connected, attempting to fetch email...');
          
          // If email is available in the status response, save it as Google email
          if (response.data.workspaceEmail) {
            console.log('Email found in status response:', response.data.workspaceEmail);
            setGoogleEmail(response.data.workspaceEmail);
          } else {
            // Try to fetch Google email separately - do this immediately for first load
            console.log('No email in status response, fetching separately...');
            fetchGoogleEmail();
          }
          
          // If we're on step 0 and we detect we're connected, show success message
          if (activeStep === 0) {
            const email = response.data.workspaceEmail || googleEmail;
            const successMsg = email 
              ? `Google account is connected (${email})` 
              : 'Google account is connected';
            console.log('Setting success message during initial check:', successMsg);
            setSuccess(successMsg);
            // Also set justConnected to enable Next button
            console.log('Setting justConnected = true');
            setJustConnected(true);
          }
        } else {
          console.log('Google is not connected');
          setGoogleConnected(false);
        }
        
        // Always log current state after check
        console.log('Current states after Google check:', {
          googleConnected: response.data.connected,
          email: response.data.workspaceEmail || googleEmail,
          justConnected
        });
        
      } catch (error) {
        console.error('Error checking Google credentials:', error);
        setGoogleConnected(false);
      }
    };

    // Call immediately on component mount
    checkGoogleCredentials();
    
    // Set up a more frequent polling initially to ensure we catch the connection
    if (activeStep === 0) {
      // Check every 2 seconds for the first 30 seconds
      const intervalId = setInterval(checkGoogleCredentials, 2000);
      // Clean up interval after 30 seconds to avoid infinite polling
      const timeoutId = setTimeout(() => clearInterval(intervalId), 30000);
      
      return () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
    }
  }, [activeStep]);

  // Improve the message handler to properly capture and use the email
  useEffect(() => {
    // Listen for messages from the OAuth popup window
    const handleAuthMessage = async (event: MessageEvent) => {
      console.log('Received message:', event.data);
      
      // Check for both string and object message formats
      if (event.data === 'google-auth-complete' || 
          (typeof event.data === 'object' && event.data?.type === 'google-auth-complete')) {
        
        console.log('Received authentication message from popup');
        
        // Get the message data
        const messageData = typeof event.data === 'object' ? event.data : {};
        
        // If the message contains the original token, restore it
        if (messageData.originalToken) {
          console.log('Restoring original token from OAuth message');
          localStorage.setItem('token', messageData.originalToken);
          axios.defaults.headers.common['Authorization'] = `Bearer ${messageData.originalToken}`;
        } else if (sessionStorage.getItem('auth_token_backup')) {
          // Fallback to the token we backed up earlier
          console.log('Restoring token from session storage backup');
          const backupToken = sessionStorage.getItem('auth_token_backup');
          localStorage.setItem('token', backupToken!);
          axios.defaults.headers.common['Authorization'] = `Bearer ${backupToken}`;
        }
        
        // Update email if available in message
        if (messageData.email) {
          console.log('Setting email from message:', messageData.email);
          setGoogleEmail(messageData.email);
        }
        
        // Process the authentication immediately
        try {
          console.log('Processing authentication immediately');
          
          // Get the current token (restored from above)
          const token = localStorage.getItem('token');
          if (!token) {
            console.error('No token available after OAuth completion');
            return;
          }
          
          // Check Google connection status with the token
          const statusRes = await axios.get('/api/google/auth-status', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (statusRes.data.connected) {
            console.log('Google connected via popup message');
            setGoogleConnected(true);
            setJustConnected(true);
            
            // Set success message with email if available
            const email = messageData.email || statusRes.data.email;
            const successMsg = `Google account connected successfully!${email ? ` (${email})` : ''}`;
            console.log('Setting success message from popup:', successMsg);
            setSuccess(successMsg);
            
            // Removed alert to provide a better user experience
            
            if (!messageData.email && !googleEmail) {
              await fetchGoogleEmail();
            }
          }
        } catch (err) {
          console.error('Error processing authentication immediately:', err);
          
          // Try again after a short delay as fallback
          setTimeout(async () => {
            try {
              console.log('Trying authentication again after delay');
              
              const token = localStorage.getItem('token');
              if (!token) {
                console.error('No token available after OAuth completion');
                return;
              }
              
              const statusRes = await axios.get('/api/google/auth-status', {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (statusRes.data.connected) {
                console.log('Google connected via popup message (delayed)');
                setGoogleConnected(true);
                setJustConnected(true);
                
                // Set success message with email if available
                const email = messageData.email || statusRes.data.email;
                const successMsg = `Google account connected successfully!${email ? ` (${email})` : ''}`;
                console.log('Setting success message from popup (delayed):', successMsg);
                setSuccess(successMsg);
                
                if (!messageData.email && !googleEmail) {
                  await fetchGoogleEmail();
                }
              }
            } catch (delayedErr) {
              console.error('Error in delayed authentication:', delayedErr);
            } finally {
              // Clean up the backup token
              sessionStorage.removeItem('auth_token_backup');
            }
          }, 1500);
        }
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => {
      window.removeEventListener('message', handleAuthMessage);
    };
  }, []);

  // Fetch email immediately when googleConnected becomes true
  useEffect(() => {
    if (googleConnected && !googleEmail) {
      console.log('Google connected but no email yet - fetching email...');
      fetchGoogleEmail();
    }
  }, [googleConnected, googleEmail]);
  
  // Clean up polling interval on unmount or step change
  useEffect(() => {
    return () => {
      if (statusPollingInterval) {
        console.log('Cleaning up polling interval on unmount or step change');
        clearInterval(statusPollingInterval);
      }
    };
  }, [statusPollingInterval]);

  // Stop polling when advancing to step 3 (Select Contracts) or beyond
  useEffect(() => {
    if (activeStep >= 3 && statusPollingInterval) {
      console.log('Stopping polling because user advanced to step 3 or beyond');
      clearInterval(statusPollingInterval);
      setStatusPollingInterval(null);
    }
  }, [activeStep, statusPollingInterval]);

  // Clear success and error when switching auth method
  useEffect(() => {
    setSuccess('');
    setError('');
    setJustConnected(false);
  }, [authMethod]);

  // Add a keyword
  const addKeyword = () => {
    if (newKeyword.trim() === '') return;
    
    setSearchParams(prev => ({
      ...prev,
      keywords: [...prev.keywords, { text: newKeyword.trim() }]
    }));
    setNewKeyword('');
  };

  // Remove a keyword
  const removeKeyword = (index: number) => {
    setSearchParams(prev => ({
      ...prev,
      keywords: prev.keywords.filter((_, i) => i !== index)
    }));
  };

  // Handle date change
  const handleDateChange = (field: 'startDate' | 'endDate', value: Date | null) => {
    setSearchParams(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Add new function to initiate OAuth flow
  const initiateGoogleAuth = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setJustConnected(false);
      setGoogleEmail(''); // Clear any existing email
      
      // Get the current auth token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to connect your Google account');
        setLoading(false);
        return;
      }
      
      // Include token in headers
      const response = await axios.get('/api/google/auth-url', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Store token in sessionStorage as backup
      sessionStorage.setItem('auth_token_backup', token);
      
      // Open the OAuth URL in a new window
      const authWindow = window.open(response.data.authUrl, '_blank', 'width=800,height=600');
      if (!authWindow) {
        setError('Popup blocked! Please allow popups for this site.');
        setLoading(false);
        return;
      }
      
      // Focus the popup window
      authWindow.focus();
      
      // Set up polling in case the message event doesn't work
      const checkAuthInterval = setInterval(async () => {
        try {
          // Ensure we still have a token
          const currentToken = localStorage.getItem('token') || sessionStorage.getItem('auth_token_backup');
          if (!currentToken) {
            console.error('Token is missing during OAuth polling');
            clearInterval(checkAuthInterval);
            return;
          }
          
          const statusRes = await axios.get('/api/google/auth-status', {
            headers: {
              'Authorization': `Bearer ${currentToken}`
            }
          });
          
          if (statusRes.data.connected) {
            clearInterval(checkAuthInterval);
            
            // Restore token from backup if needed
            if (!localStorage.getItem('token') && sessionStorage.getItem('auth_token_backup')) {
              localStorage.setItem('token', sessionStorage.getItem('auth_token_backup')!);
              axios.defaults.headers.common['Authorization'] = `Bearer ${sessionStorage.getItem('auth_token_backup')}`;
            }
            
            setGoogleConnected(true);
            setJustConnected(true);
            setSuccess('Google account connected successfully!');
            await fetchGoogleEmail();
          }
        } catch (err) {
          console.error('Error checking auth status:', err);
        }
      }, 2000);
      
      // Clear interval after 2 minutes
      setTimeout(() => {
        clearInterval(checkAuthInterval);
      }, 120000);
      
    } catch (error: any) {
      console.error('Error initiating Google auth:', error);
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.error?.details || 
                          'Failed to initiate Google authentication';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Update the uploadGoogleCredentials function for service accounts to use googleEmail
  const uploadGoogleCredentials = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setSuccess('');
    setError('');
    setJustConnected(false);
    setGoogleEmail(''); // Clear any existing email

    const credentialFile = files[0];
    
    // Validate file type
    if (!credentialFile.name.endsWith('.json')) {
      setError('Please upload a JSON file');
      return;
    }
    
    // Validate workspace email when using service account
    if (authMethod === 'service_account' && (!workspaceEmail || !workspaceEmail.includes('@'))) {
      setError('Please enter a valid Google Workspace email address');
      return;
    }
    
    const formData = new FormData();
    formData.append('credentials', credentialFile);
    formData.append('workspaceEmail', workspaceEmail);

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setJustConnected(false);
      
      const response = await axios.post('/api/google/upload-credentials', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setGoogleConnected(true);
      
      // For service accounts, use the provided workspace email
      if (authMethod === 'service_account' && workspaceEmail) {
        setGoogleEmail(workspaceEmail);
        setSuccess(`Google credentials uploaded successfully`);
      } else {
        // For other types of credentials, try to fetch the email after a delay
        // to ensure backend has processed the credentials
        setTimeout(async () => {
          await fetchGoogleEmail();
        }, 1000);
        
        setSuccess(response.data.message || 'Google credentials uploaded successfully');
      }
      
      setJustConnected(true);
    } catch (error: any) {
      console.error('Error uploading credentials:', error);
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.error?.details || 
                          'Failed to upload Google credentials';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Test Google API connection
  const testGoogleConnection = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await axios.get('/api/google/test-connection');
      
      // Format the test results to display
      const testResults = response.data;
      const status = (
        testResults.authentication === 'success' && 
        testResults.services.gmail?.status === 'success' && 
        testResults.services.drive?.status === 'success'
      ) ? 'Success' : 'Partial Success';
      
      // Check for email address in test results and update googleEmail if available
      if (testResults.workspaceEmail) {
        setGoogleEmail(testResults.workspaceEmail);
      } else if (testResults.services.gmail?.emailAddress) {
        setGoogleEmail(testResults.services.gmail.emailAddress);
      }
      
      const details = [
        `Authentication: ${testResults.authentication}`,
        `Workspace Email: ${testResults.workspaceEmail || googleEmail || 'Not available'}`,
        `Gmail API: ${testResults.services.gmail?.status || 'Not tested'} ${testResults.services.gmail?.error ? '- ' + testResults.services.gmail.error : ''}`,
        `Drive API: ${testResults.services.drive?.status || 'Not tested'} ${testResults.services.drive?.error ? '- ' + testResults.services.drive.error : ''}`
      ];
      
      if (testResults.services.gmail?.emailAddress) {
        details.push(`Gmail Account: ${testResults.services.gmail.emailAddress}`);
      }
      
      if (testResults.services.drive?.quotaUsage) {
        details.push(`Drive Storage: ${testResults.services.drive.quotaUsage}`);
      }
      
      // Update the connected status based on test results
      if (testResults.authentication === 'success') {
        setGoogleConnected(true);
      }
      
      setSuccess(`Google API Test: ${status}\n${details.join('\n')}`);
    } catch (error: any) {
      console.error('Error testing Google connection:', error);
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.error?.details || 
                          'Failed to test Google API connection';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Search for contracts with keywords and date range using Gmail API
  const searchContracts = async () => {
    if (searchParams.keywords.length === 0) {
      setError('Please add at least one keyword');
      return;
    }

    try {
      // Clear any existing polling interval
      if (statusPollingInterval) {
        console.log('Clearing existing polling interval before new search');
        clearInterval(statusPollingInterval);
        setStatusPollingInterval(null);
      }
      
      // Reset any existing search state
      setVaultSearch(null);
      setContracts([]);
      
      setLoading(true);
      setError('');
      
      console.log('Starting Gmail search with params:', {
        description: searchDescription || 'Contract Search',
        keywords: searchParams.keywords.map(k => k.text),
        startDate: searchParams.startDate,
        endDate: searchParams.endDate
      });
      
      // Use Gmail API endpoint instead of Vault API
      const response = await axios.post('/api/gmail/search', {
        description: searchDescription || 'Contract Search',
        keywords: searchParams.keywords.map(k => k.text),
        startDate: searchParams.startDate ? searchParams.startDate.toISOString() : null,
        endDate: searchParams.endDate ? searchParams.endDate.toISOString() : null,
        service: searchParams.service,
        dataSource: searchParams.dataSource,
        entityType: searchParams.entityType,
        specificAccounts: searchParams.specificAccounts,
        timeZone: searchParams.timeZone,
        excludeDrafts: searchParams.excludeDrafts,
        includeAllMatches: searchParams.includeAllMatches
      }, {
        timeout: 30000 // 30 second timeout
      });
      
      console.log('Search started successfully, response:', response.data);
      
      setVaultSearch({
        id: response.data.id,
        matterId: response.data.matterId || 'direct-api',
        status: response.data.status,
        description: searchDescription || 'Contract Search',
        statusCheckFailCount: 0
      });
      
      // Set up polling for status updates - use a more reasonable interval for Gmail API (5 seconds)
      console.log(`Setting up polling for search ID: ${response.data.id}`);
      const interval = setInterval(() => checkSearchStatus(response.data.id), 5000);
      setStatusPollingInterval(interval);
      
      setSuccess('Gmail search started successfully. Waiting for results...');
      setActiveStep(2); // Move to waiting step
    } catch (error: any) {
      console.error('Error starting Gmail search:', error);
      
      let errorMessage = 'Failed to start Gmail search';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'The request timed out. The server might be busy, please try again.';
      } else if (error.response?.data?.error) {
        // Extract detailed error information if available
        errorMessage = error.response.data.error.message || 
                      error.response.data.error.details || 
                      'Failed to start Gmail search';
        
        // Add error code if available
        if (error.response.data.error.code) {
          errorMessage += ` (Error code: ${error.response.data.error.code})`;
        }
      }
      
      setError(`${errorMessage}. Please check server logs for more details.`);
    } finally {
      setLoading(false);
    }
  };
  
  // Check the status of a search
  const checkSearchStatus = async (searchId: number) => {
    try {
      console.log(`Checking status for search ${searchId}`);
      const response = await axios.get(`/api/gmail/search/${searchId}`, {
        timeout: 10000 // 10 second timeout for status check
      });
      
      console.log('Search status response:', response.data);
      
      // Update search status
      setVaultSearch(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: response.data.status
        };
      });
      
      // If search is completed, clear interval and process results
      if (response.data.status === 'COMPLETED') {
        console.log('Search completed, processing results');
        
        // Always clear interval BEFORE calling processSearchResults
        if (statusPollingInterval) {
          console.log('Clearing polling interval due to COMPLETED status');
          clearInterval(statusPollingInterval);
          setStatusPollingInterval(null);
        }
        
        await processSearchResults(searchId);
        return; // Exit after processing to prevent any further status checks
      } 
      // If search failed, clear interval and show error
      else if (response.data.status === 'FAILED') {
        console.log('Search failed');
        if (statusPollingInterval) {
          console.log('Clearing polling interval due to FAILED status');
          clearInterval(statusPollingInterval);
          setStatusPollingInterval(null);
        }
        setError('Search failed. Please try again with different criteria.');
        setLoading(false);
      } else {
        console.log('Search still in progress...');
      }
    } catch (error: any) {
      console.error('Error checking search status:', error);
      
      // Don't stop polling just because of a single failed status check
      // But provide feedback to the user
      let errorMessage = 'Error checking search status. Will retry automatically.';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Status check timed out. Retrying automatically...';
      }
      
      setError(errorMessage);
      
      // After 5 failed status checks, stop polling (reduced from 10 since Gmail API should be faster)
      if ((vaultSearch?.statusCheckFailCount || 0) >= 5) {
        if (statusPollingInterval) {
          console.log('Clearing polling interval due to too many failures');
          clearInterval(statusPollingInterval);
          setStatusPollingInterval(null);
        }
        setError('Too many failures checking search status. Please try processing the results manually.');
        setLoading(false);
      } else {
        // Increment the fail count
        setVaultSearch(prev => {
          if (!prev) return null;
          return {
            ...prev,
            statusCheckFailCount: (prev.statusCheckFailCount || 0) + 1
          };
        });
      }
    }
  };
  
  // Process the results of a completed search
  const processSearchResults = async (searchId: number) => {
    try {
      // First, explicitly clear any existing polling to prevent overlapping calls
      if (statusPollingInterval) {
        console.log("Clearing status polling interval");
        clearInterval(statusPollingInterval);
        setStatusPollingInterval(null);
      }

      setLoading(true);
      setError('');
      
      console.log(`Processing search results for search ID: ${searchId}`);
      
      // Process the search results with a timeout
      const response = await axios.post(`/api/gmail/process/${searchId}`, {}, {
        timeout: 30000 // 30 second timeout
      });
      
      console.log("Search results response:", response.data);
      
      // If there are no contracts, show a message and don't proceed
      if (!response.data.contracts || response.data.contracts.length === 0) {
        setError('No contracts found. Try adjusting your search criteria.');
        setLoading(false);
        return;
      }
      
      // Format contracts for selection
      const formattedContracts = response.data.contracts.map((item: any) => ({
        id: item.id || item.name || `contract-${Math.random().toString(36).substring(2, 7)}`,
        name: item.name || item.subject || 'Unnamed Contract',
        path: item.sourceLocation || '',
        selected: true, // Select all by default
        size: item.size || 0,
        lastModified: item.date || new Date().toISOString(),
        scanned: false,
        sourceType: item.source || 'gmail',
        sourceLocation: item.sourceLocation || '',
        renewalDate: item.renewalDate || null,
        amount: item.amount || 0,
        parties: item.parties || []
      }));
      
      setContracts(formattedContracts);
      setSuccess(`Found ${formattedContracts.length} potential contracts`);
      
      // Move to contract selection step - this should trigger our useEffect to clean up polling
      setActiveStep(3);
      
      // For safety, double-check that polling is really stopped
      setTimeout(() => {
        if (statusPollingInterval) {
          console.log("Backup cleanup of polling interval");
          clearInterval(statusPollingInterval);
          setStatusPollingInterval(null);
        }
      }, 100);
    } catch (error: any) {
      console.error('Error processing search results:', error);
      
      // Provide a more user-friendly error message
      let errorMessage;
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'The request timed out. The server might be busy processing your search.';
      } else {
        errorMessage = error.response?.data?.error?.message || 
                      error.response?.data?.error?.details || 
                      'Failed to process search results';
      }
      
      setError(errorMessage);
      
      // If we get a timeout, suggest manual retry
      if (error.code === 'ECONNABORTED') {
        // Create a button to manually retry processing
        setSuccess('You can try processing the search results again by clicking the "Process Results" button below.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Toggle contract selection
  const toggleContractSelection = (id: string) => {
    setContracts(prevContracts => 
      prevContracts.map(contract => 
        contract.id === id 
          ? { ...contract, selected: !contract.selected } 
          : contract
      )
    );
  };

  // Select/Deselect all contracts
  const toggleSelectAll = (selected: boolean) => {
    setContracts(prevContracts => 
      prevContracts.map(contract => ({ ...contract, selected }))
    );
  };

  // Process contracts for review
  const processContracts = async () => {
    const selectedContracts = contracts.filter(c => c.selected);
    if (selectedContracts.length === 0) {
      setError('Please select at least one contract to process');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Mark selected contracts as scanned
      // Vault API already provides analysis data, so we just mark them as ready
      setContracts(prev => 
        prev.map(contract => 
          contract.selected ? { ...contract, scanned: true } : contract
        )
      );
      
      setSuccess('Contracts processed successfully');
      setActiveStep(4); // Move to review step
    } catch (error) {
      console.error('Error processing contracts:', error);
      setError('Failed to process contracts');
    } finally {
      setLoading(false);
    }
  };

  // Upload finalized contracts to database
  const uploadContractsToDB = async () => {
    const finalizedContracts = contracts.filter(c => c.selected && c.scanned);
    if (finalizedContracts.length === 0) {
      setError('No processed contracts to upload');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await axios.post('/api/contracts/batch', {
        contracts: finalizedContracts
      });
      
      setSuccess(`Successfully uploaded ${finalizedContracts.length} contracts`);
      setActiveStep(steps.length);
    } catch (error) {
      console.error('Error uploading contracts:', error);
      setError('Failed to upload contracts to database');
    } finally {
      setLoading(false);
    }
  };

  // Handle next step
  const handleNext = () => {
    if (activeStep === 0 && !googleConnected && !justConnected) {
      setError('You need to connect your Google account first');
      return;
    }
    
    if (activeStep === 1) {
      searchContracts();
      return; // searchContracts will advance the step if successful
    }
    
    if (activeStep === 3) {
      processContracts();
      return; // processContracts will advance the step if successful
    }
    
    if (activeStep === 4) {
      uploadContractsToDB();
      return;
    }
    
    setActiveStep(prevStep => prevStep + 1);
  };

  // Handle back step
  const handleBack = () => {
    setActiveStep(prevStep => prevStep - 1);
  };

  // Add a function to disconnect Google account
  const disconnectGoogle = async () => {
    try {
      setLoading(true);
      
      const response = await axios.post('/api/google/disconnect');
      setGoogleConnected(false);
      setGoogleEmail('');
      setSuccess(response.data.message || 'Google account disconnected successfully');
      
      // Reset states
      setJustConnected(false);
      
    } catch (error) {
      console.error('Error disconnecting Google account:', error);
      setError('Failed to disconnect Google account');
    } finally {
      setLoading(false);
    }
  };

  // Rename the function for clarity but keep the same functionality
  const editSearch = () => {
    // Clear any existing polling interval
    if (statusPollingInterval) {
      console.log("Clearing polling interval for search edit");
      clearInterval(statusPollingInterval);
      setStatusPollingInterval(null);
    }
    
    // Reset search state while preserving criteria
    setVaultSearch(null);
    setContracts([]);
    
    // Go back to search criteria step
    setActiveStep(1);
    
    // Keep the existing search keywords but clear any error message
    setError('');
    setSuccess('');
    setLoading(false);
  };

  // Render step content
  const getStepContent = (stepIndex: number): React.ReactNode => {
    switch (stepIndex) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Connect to Google Account
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              Connect your Google account to search for contracts in Gmail and Google Drive.
            </Alert>
            
            {/* Only show ONE success alert in the form content */}
            {googleConnected ? (
              <Alert severity="success" sx={{ mb: 3 }}>
                <Typography fontWeight="medium">
                  Google account is connected
                  {emailLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, gap: 1 }}>
                      <CircularProgress size={16} />
                      <span>Fetching email...</span>
                    </Box>
                  ) : googleEmail ? (
                    <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                      <strong>Email:</strong> {googleEmail}
                    </Box>
                  ) : (
                    <Box component="span" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                      Email information not available
                      <Button 
                        size="small" 
                        variant="text" 
                        color="primary" 
                        onClick={fetchGoogleEmail}
                        disabled={emailLoading}
                        sx={{ ml: 1 }}
                      >
                        Try Again
                      </Button>
                    </Box>
                  )}
                  <Box sx={{ mt: 1 }}>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      color="error" 
                      onClick={disconnectGoogle}
                      disabled={loading}
                      startIcon={<DeleteIcon fontSize="small" />}
                    >
                      Disconnect
                    </Button>
                  </Box>
                </Typography>
              </Alert>
            ) : justConnected ? (
              <Alert severity="success" sx={{ mt: 2, mb: 3 }}>
                <Typography fontWeight="medium">
                  Google account connected successfully!
                  {emailLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, gap: 1 }}>
                      <CircularProgress size={16} />
                      <span>Fetching email...</span>
                    </Box>
                  ) : googleEmail ? (
                    <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                      <strong>Email:</strong> {googleEmail}
                    </Box>
                  ) : (
                    <Box component="span" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                      Email information not available
                      <Button 
                        size="small" 
                        variant="text" 
                        color="primary" 
                        onClick={fetchGoogleEmail}
                        disabled={emailLoading}
                        sx={{ ml: 1 }}
                      >
                        Try Again
                      </Button>
                    </Box>
                  )}
                  <Box sx={{ mt: 1 }}>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      color="error" 
                      onClick={disconnectGoogle}
                      disabled={loading}
                      startIcon={<DeleteIcon fontSize="small" />}
                    >
                      Disconnect
                    </Button>
                  </Box>
                </Typography>
              </Alert>
            ) : null}

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="auth-method-label">Authentication Method</InputLabel>
              <Select
                labelId="auth-method-label"
                id="auth-method-select"
                value={authMethod}
                label="Authentication Method"
                onChange={(e) => setAuthMethod(e.target.value as 'oauth' | 'service_account')}
              >
                <MenuItem value="oauth">Regular Google Account (Personal Gmail)</MenuItem>
                <MenuItem value="service_account">Google Workspace (with Service Account)</MenuItem>
              </Select>
            </FormControl>
            
            {authMethod === 'oauth' ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Use this option if you want to connect your personal Gmail account. You'll be redirected to Google's login page.
                </Typography>
                
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<img src="/google-icon.svg" alt="Google" width="20" height="20" style={{ marginRight: '8px' }} />}
                  onClick={initiateGoogleAuth}
                  disabled={loading}
                  fullWidth
                  sx={{ py: 1.5 }}
                >
                  Connect with Google
                </Button>
                
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                  This will open a new window where you can authorize access to your Gmail and Drive
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Use this option if you're connecting to a Google Workspace account with a service account JSON key.
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      required
                      fullWidth
                      label="Google Workspace Email"
                      variant="outlined"
                      placeholder="workspace_user@your-domain.com"
                      value={workspaceEmail}
                      onChange={(e) => setWorkspaceEmail(e.target.value)}
                      helperText="The email address that will be used to access Google Workspace data"
                    />
                  </Grid>
                </Grid>
                
                <Button
                  variant="contained"
                  component="label"
                  startIcon={<UploadIcon />}
                  color="primary"
                  sx={{ mt: 1 }}
                  disabled={googleConnected}
                >
                  Upload Service Account Credentials
                  <input
                    type="file"
                    hidden
                    accept=".json"
                    onChange={uploadGoogleCredentials}
                  />
                </Button>
                
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  This requires a service account with domain-wide delegation enabled in your Google Workspace admin console.
                </Typography>
              </Box>
            )}
            
            <Box sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                color="primary"
                onClick={testGoogleConnection}
                disabled={loading}
                startIcon={<RefreshIcon />}
              >
                Test Connection
              </Button>
            </Box>
          </Box>
        );
      
      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Define Search Criteria
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              Enter keywords and date range to search for contract-related emails and documents in Gmail and Google Drive.
            </Alert>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Search Description"
                  variant="outlined"
                  placeholder="Q1 2023 Contracts Review"
                  value={searchDescription}
                  onChange={(e) => setSearchDescription(e.target.value)}
                  helperText="A descriptive name for this search (will be used for matter creation)"
                  margin="normal"
                />
              </Grid>
            
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth variant="outlined" margin="normal">
                  <InputLabel>Service</InputLabel>
                  <Select
                    value={searchParams.service}
                    onChange={(e) => setSearchParams(prev => ({ 
                      ...prev, 
                      service: e.target.value as 'MAIL' | 'DRIVE' | 'GROUPS' | 'HANGOUTS_CHAT' | 'ALL'
                    }))}
                    label="Service"
                  >
                    <MenuItem value="MAIL">Gmail</MenuItem>
                    <MenuItem value="DRIVE">Drive</MenuItem>
                    <MenuItem value="GROUPS">Groups</MenuItem>
                    <MenuItem value="HANGOUTS_CHAT">Chat</MenuItem>
                    <MenuItem value="ALL">All Services</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth variant="outlined" margin="normal">
                  <InputLabel>Data Source</InputLabel>
                  <Select
                    value={searchParams.dataSource}
                    onChange={(e) => setSearchParams(prev => ({ 
                      ...prev, 
                      dataSource: e.target.value as 'ALL_DATA' | 'HELD_DATA' | 'UNPROCESSED_DATA'
                    }))}
                    label="Data Source"
                  >
                    <MenuItem value="ALL_DATA">All Data</MenuItem>
                    <MenuItem value="HELD_DATA">Held Data</MenuItem>
                    <MenuItem value="UNPROCESSED_DATA">Unprocessed Data</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth variant="outlined" margin="normal">
                  <InputLabel>Entity</InputLabel>
                  <Select
                    value={searchParams.entityType}
                    onChange={(e) => setSearchParams(prev => ({ 
                      ...prev, 
                      entityType: e.target.value as 'ALL_ACCOUNTS' | 'SPECIFIC_ACCOUNTS'
                    }))}
                    label="Entity"
                  >
                    <MenuItem value="ALL_ACCOUNTS">All Accounts</MenuItem>
                    <MenuItem value="SPECIFIC_ACCOUNTS">Specific Accounts</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {searchParams.entityType === 'SPECIFIC_ACCOUNTS' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Specific Accounts"
                    variant="outlined"
                    placeholder="user1@domain.com, user2@domain.com"
                    value={searchParams.specificAccounts?.join(', ') || ''}
                    onChange={(e) => setSearchParams(prev => ({ 
                      ...prev, 
                      specificAccounts: e.target.value.split(',').map(email => email.trim())
                    }))}
                    helperText="Enter comma-separated email addresses"
                  />
                </Grid>
              )}
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth variant="outlined" margin="normal">
                  <InputLabel>Time Zone</InputLabel>
                  <Select
                    value={searchParams.timeZone}
                    onChange={(e) => setSearchParams(prev => ({ 
                      ...prev, 
                      timeZone: e.target.value as string
                    }))}
                    label="Time Zone"
                  >
                    <MenuItem value="UTC">UTC</MenuItem>
                    <MenuItem value="America/New_York">Eastern Time</MenuItem>
                    <MenuItem value="America/Chicago">Central Time</MenuItem>
                    <MenuItem value="America/Denver">Mountain Time</MenuItem>
                    <MenuItem value="America/Los_Angeles">Pacific Time</MenuItem>
                    <MenuItem value="Asia/Kolkata">India (Kolkata)</MenuItem>
                    <MenuItem value="Europe/London">London</MenuItem>
                    <MenuItem value="Europe/Paris">Paris</MenuItem>
                    <MenuItem value="Asia/Tokyo">Tokyo</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Start Date"
                    value={searchParams.startDate}
                    onChange={(date) => handleDateChange('startDate', date)}
                    slotProps={{
                      textField: { 
                        fullWidth: true,
                        variant: 'outlined',
                        helperText: 'Search contracts from this date'
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="End Date"
                    value={searchParams.endDate}
                    onChange={(date) => handleDateChange('endDate', date)}
                    slotProps={{
                      textField: { 
                        fullWidth: true,
                        variant: 'outlined',
                        helperText: 'Search contracts until this date'
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={searchParams.excludeDrafts}
                      onChange={(e) => setSearchParams(prev => ({
                        ...prev,
                        excludeDrafts: e.target.checked
                      }))}
                    />
                  }
                  label="Exclude email drafts"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={searchParams.includeAllMatches}
                      onChange={(e) => setSearchParams(prev => ({
                        ...prev,
                        includeAllMatches: e.target.checked
                      }))}
                    />
                  }
                  label="Include all search matches (not just contracts)"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Keywords
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TextField
                    label="Add Keyword"
                    variant="outlined"
                    size="small"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                    fullWidth
                    placeholder="e.g. contract, agreement, license"
                  />
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addKeyword}
                    variant="contained"
                    color="primary"
                    sx={{ ml: 1, height: 40 }}
                  >
                    Add
                  </Button>
                </Box>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {searchParams.keywords.map((keyword, index) => (
                    <Chip
                      key={index}
                      label={keyword.text}
                      onDelete={() => removeKeyword(index)}
                      color="primary"
                    />
                  ))}
                </Box>
                
                {searchParams.keywords.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No keywords added yet. Add at least one keyword to search.
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Box>
        );
      
      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Searching Gmail and Drive
            </Typography>

            {error && error.includes('No contracts found') && (
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  {error}
                </Alert>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={editSearch}
                  startIcon={<ScanIcon />}
                >
                  Edit Search Criteria
                </Button>
              </Box>
            )}
            
            {vaultSearch ? (
              <>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body1" gutterBottom>
                    Search ID: {vaultSearch.id}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <Typography variant="body2" sx={{ mr: 1 }}>
                      Status: {vaultSearch.status}
                    </Typography>
                    {vaultSearch.status === 'PROCESSING' && (
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                    )}
                    {/* Edit Search button */}
                    <Button 
                      size="small"
                      color="primary"
                      onClick={editSearch}
                      disabled={loading}
                      sx={{ ml: 'auto' }}
                    >
                      Edit Search
                    </Button>
                  </Box>
                </Box>

                {vaultSearch.status === 'COMPLETED' && (
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="body1" gutterBottom>
                      Search completed. Processing results...
                    </Typography>
                    <CircularProgress size={24} sx={{ mt: 1 }} />
                  </Box>
                )}

                {vaultSearch.status === 'FAILED' && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="error">
                      <Typography variant="body1" gutterBottom>
                        Search failed. Please try again with different criteria.
                      </Typography>
                      <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={editSearch}
                        sx={{ mt: 1 }}
                      >
                        Edit Search Criteria
                      </Button>
                    </Alert>
                  </Box>
                )}

                {/* Rest of the existing UI */}
              </>
            ) : (
              <Alert severity="info">
                Waiting for Gmail search results...
                <LinearProgress sx={{ mt: 2 }} />
              </Alert>
            )}
          </Box>
        );
      
      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Contracts
            </Typography>
            
            {contracts.length === 0 ? (
              <Box sx={{ textAlign: 'center', mt: 3 }}>
                <Alert severity="info" sx={{ mb: 2 }}>No contracts found. Go back and adjust your search criteria.</Alert>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={editSearch}
                  startIcon={<ScanIcon />}
                >
                  Edit Search
                </Button>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography>
                    {contracts.filter(c => c.selected).length} of {contracts.length} contracts selected
                  </Typography>
                  <Box>
                    <Button 
                      size="small" 
                      onClick={() => toggleSelectAll(true)}
                      sx={{ mr: 1 }}
                    >
                      Select All
                    </Button>
                    <Button 
                      size="small" 
                      onClick={() => toggleSelectAll(false)}
                      sx={{ mr: 1 }}
                    >
                      Deselect All
                    </Button>
                    <Button 
                      size="small"
                      color="primary"
                      onClick={editSearch}
                    >
                      Edit Search
                    </Button>
                  </Box>
                </Box>
                
                <List sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
                  {contracts.map(contract => (
                    <ListItem 
                      key={contract.id} 
                      button 
                      onClick={() => toggleContractSelection(contract.id)}
                      selected={contract.selected}
                      sx={{ borderBottom: '1px solid #eee' }}
                    >
                      <ListItemIcon>
                        <Checkbox checked={contract.selected} />
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {contract.name}
                            <Chip 
                              size="small" 
                              label={contract.sourceType === 'gmail' ? 'Gmail' : 'Drive'}
                              sx={{ ml: 1 }}
                            />
                          </Box>
                        }
                        secondary={`Last Modified: ${new Date(contract.lastModified).toLocaleDateString()}`} 
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Box>
        );
      
      case 4:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review Processed Contracts
            </Typography>
            
            <Grid container spacing={2}>
              {contracts.filter(c => c.selected && c.scanned).map(contract => (
                <Grid item xs={12} md={6} key={contract.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6">{contract.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Source: {contract.sourceType === 'gmail' ? 'Gmail' : 'Google Drive'}
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        <strong>Renewal Date:</strong> {contract.renewalDate || 'Not detected'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Amount:</strong> {contract.amount ? `$${contract.amount.toLocaleString()}` : 'Not detected'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Parties:</strong> {contract.parties?.join(', ') || 'Not detected'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            
            {contracts.filter(c => c.selected && c.scanned).length === 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                No contracts have been processed. Go back and select contracts to process.
              </Alert>
            )}
          </Box>
        );
      
      default:
        return 'Unknown step';
    }
  };

  // Add this useEffect to handle URL parameters for OAuth redirect
  useEffect(() => {
    // Check if we have a 'google-connected' query parameter
    const url = new URL(window.location.href);
    const googleConnected = url.searchParams.get('google-connected');
    const email = url.searchParams.get('email');
    
    console.log('Checking URL parameters:', { googleConnected, email });
    
    if (googleConnected === 'true') {
      console.log('Google connected param detected, setting states');
      
      // Remove the parameters from URL without refreshing
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Show success message with email if available
      setGoogleConnected(true);
      setJustConnected(true);
      
      // Set explicit success message
      const successMsg = `Google account connected successfully!${email ? ` (${email})` : ''}`;
      console.log('Setting success message:', successMsg);
      setSuccess(successMsg);
      
      // If email is in the URL, use it
      if (email) {
        console.log('Setting email from URL param:', email);
        setGoogleEmail(email);
      } else {
        // Otherwise fetch email
        console.log('No email in URL, fetching from API');
        fetchGoogleEmail();
      }
      
      // Force check credentials again to ensure states are updated
      setTimeout(() => {
        axios.get('/api/google/status')
          .then(response => {
            console.log('Force checking Google status after redirect:', response.data);
            if (response.data.connected) {
              setGoogleConnected(true);
              if (response.data.workspaceEmail) {
                setGoogleEmail(response.data.workspaceEmail);
              }
            }
          })
          .catch(err => console.error('Error force-checking Google status:', err));
      }, 500);
    }
  }, []);

  useEffect(() => {
    // Force check Google connection status on component mount
    console.log('Component mounted - checking Google connection status');
    axios.get('/api/google/status')
      .then(response => {
        console.log('Initial Google status check:', response.data);
        if (response.data.connected) {
          console.log('Setting initial googleConnected = true from component mount');
          setGoogleConnected(true);
          if (response.data.workspaceEmail) {
            setGoogleEmail(response.data.workspaceEmail);
          }
        }
      })
      .catch(err => console.error('Error in initial Google status check:', err));
  }, []); // Empty dependency array - only run once on mount

  return (
    <Container maxWidth="lg">
      <Paper elevation={3} sx={{ p: 3, my: 3 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          Show Renewals Search & Upload
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
          Search for renewals in Gmail and Google Drive, analyze them with AI, and add them to your renewals database.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Display all success messages in main UI */}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        {/* Debug info - will be visible to help troubleshoot */}
        <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1, fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="subtitle2">Debug Information:</Typography>
          <Box>googleConnected: {googleConnected ? 'true' : 'false'}</Box>
          <Box>justConnected: {justConnected ? 'true' : 'false'}</Box>
          <Box>googleEmail: {googleEmail || 'not set'}</Box>
          <Box>Step {activeStep}: {steps[activeStep]}</Box>
          <Button size="small" variant="outlined" onClick={() => {
            console.log("Manual state check triggered");
            axios.get('/api/google/status')
              .then(response => {
                console.log('Manual status check:', response.data);
                if (response.data.connected) {
                  setGoogleConnected(true);
                  console.log('Manually setting googleConnected = true');
                  alert('Google is connected! Updating state...');
                }
              });
          }}>
            Force Check Connection
          </Button>
        </Box>

        <Box sx={{ width: '100%' }}>
          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Always show connection status when on step 0 */}
          {activeStep === 0 && googleConnected && (
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography>
                <strong>Google account is connected!</strong>
                {googleEmail ? ` Using email: ${googleEmail}` : ' Email information not available.'}
              </Typography>
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="body1">Processing your request...</Typography>
            </Box>
          ) : (
            <>
              {activeStep === steps.length ? (
                <Box sx={{ mt: 3, mb: 1 }}>
                  <Alert severity="success" sx={{ mb: 3 }}>
                    All contracts have been successfully processed and added to your database.
                  </Alert>
                  <Button 
                    variant="contained" 
                    onClick={() => {
                      setContracts([]);
                      setActiveStep(0);
                      setSuccess('');
                      setError('');
                    }}
                  >
                    Start New Search
                  </Button>
                </Box>
              ) : (
                <Box>
                  <Box sx={{ p: 2 }}>
                    {getStepContent(activeStep)}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                    {activeStep !== 0 && activeStep !== 2 && (
                      <Button onClick={handleBack} sx={{ mr: 1 }}>
                        Back
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      disabled={
                        (activeStep === 0 && !googleConnected) ||
                        (activeStep === 1 && searchParams.keywords.length === 0) ||
                        loading
                      }
                    >
                      {activeStep === steps.length - 1 ? 'Upload to Database' : 'Next'}
                    </Button>
                  </Box>
                </Box>
              )}
            </>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default UploadContracts; 