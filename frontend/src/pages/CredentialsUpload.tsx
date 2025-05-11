import React, { useState, useRef } from 'react';
import {
  Container, Typography, Box, Paper, Button, CircularProgress,
  Alert, TextField, Divider, Card, CardContent, Link
} from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const CredentialsUpload: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    
    if (files && files.length > 0) {
      // Accept only JSON files
      const selectedFile = files[0];
      if (selectedFile.type !== 'application/json' && !selectedFile.name.endsWith('.json')) {
        setError('Please upload a JSON file');
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('credentials_file', file);

      const response = await axios.post('/api/google/credentials', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Update user data to reflect that credentials are now uploaded
      if (user) {
        updateUser({
          ...user,
          google_credentials: true
        });
      }

      setSuccess('Google Workspace credentials uploaded successfully!');
      setFile(null);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Error uploading credentials:', err);
      setError(err.response?.data?.detail || 'Failed to upload credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!user?.google_credentials) {
      setError('Please upload your Google Workspace credentials first');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.get('/api/google/check-connection');
      setSuccess(`Connection successful! ${response.data.message}`);
    } catch (err: any) {
      console.error('Error testing connection:', err);
      setError(err.response?.data?.detail || 'Failed to connect to Google Workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="h1">
        Google Workspace Credentials
      </Typography>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Instructions
        </Typography>
        <Typography paragraph>
          To use the Show Renewals, you need to provide credentials for your Google Workspace account. 
          This will allow the application to search for contracts in your Gmail and Drive using Google Vault API.
        </Typography>
        <Typography paragraph>
          1. Go to the <Link href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</Link>
          <br />
          2. Create a new project or select an existing one
          <br />
          3. Enable the Google Vault API, Gmail API, Drive API, and Calendar API
          <br />
          4. Create a Service Account with appropriate permissions
          <br />
          5. Generate and download a JSON key file for the service account
          <br />
          6. Upload the JSON key file below
        </Typography>
      </Paper>
      
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}
      
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Upload Credentials
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUploadIcon />}
              disabled={loading}
            >
              Select JSON File
              <input
                type="file"
                hidden
                accept="application/json,.json"
                onChange={handleFileChange}
                ref={fileInputRef}
              />
            </Button>
            <Typography sx={{ ml: 2 }}>
              {file ? file.name : 'No file selected'}
            </Typography>
          </Box>
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpload}
            disabled={!file || loading}
            sx={{ mr: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Upload Credentials'}
          </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Test Connection
          </Typography>
          <Typography paragraph>
            Test your connection to Google Workspace to make sure the credentials are working correctly.
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleTestConnection}
            disabled={loading || !user?.google_credentials}
          >
            {loading ? <CircularProgress size={24} /> : 'Test Connection'}
          </Button>
        </CardContent>
      </Card>
    </Container>
  );
};

export default CredentialsUpload; 