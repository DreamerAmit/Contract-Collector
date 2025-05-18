const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { User, Contract, Keyword } = require('../models');
const { analyzeDocument } = require('../utils/openai');
const { extractTextFromPdf, extractTextFromDoc } = require('../utils/documentProcessor');
const {
  createVaultClient, 
  createMatter, 
  createGmailExport,
  createDriveExport,
  checkExportStatus,
  listExports,
  processExportedFiles,
  createEmailExport
} = require('../utils/vaultClient');
const { VaultSearch } = require('../models');

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/credentials');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `google-credentials-${req.user.id}.json`);
  }
});

const upload = multer({ storage });

// Google OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate Google OAuth URL
router.get('/auth-url', authenticate, async (req, res) => {
  try {
    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar'
    ];
    
    // Get the current token from the request
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    // Include user ID and token in the state parameter for security and session continuity
    const state = Buffer.from(JSON.stringify({
      userId: req.user.id,
      timestamp: Date.now(),
      token: token // Include the token in the state
    })).toString('base64');
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force to get refresh token
      include_granted_scopes: true,
      state: state
    });
    
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({
      error: { message: 'Failed to generate auth URL', details: error.message }
    });
  }
});

// Handle Google OAuth callback
router.get('/oauth-callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).send('<h1>Authorization Failed</h1><p>No authorization code received. Please try again.</p>');
    }
    
    // Extract user ID from state if available
    let userId = null;
    let originalToken = null;
    
    try {
      if (state) {
        // Use Buffer for proper base64 decoding (more reliable than atob)
        const decodedState = Buffer.from(state, 'base64').toString();
        const stateData = JSON.parse(decodedState);
        userId = stateData.userId;
        originalToken = stateData.token; // Get original token from state
        console.log('Decoded state data:', { userId, hasToken: !!originalToken });
      }
    } catch (e) {
      console.error('Error parsing state:', e);
    }
    
    if (!userId) {
      return res.status(400).send('<h1>Authentication Failed</h1><p>User session not found. Please try again.</p>');
    }
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens || !tokens.refresh_token) {
      return res.status(400).send('<h1>Authentication Failed</h1><p>Did not receive a refresh token. Please try again and make sure to approve all permissions.</p>');
    }
    
    // Store refresh token with user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('<h1>Authentication Failed</h1><p>User not found. Please try again.</p>');
    }
    
    // Get user's email from token info
    let userEmail = null;
    try {
      oauth2Client.setCredentials(tokens);
      const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
      userEmail = tokenInfo.email;
      console.log('Retrieved email from token info:', userEmail);
    } catch (e) {
      console.error('Error getting token info:', e);
    }
    
    // Store tokens in the database
    user.googleRefreshToken = JSON.stringify(tokens);
    user.googleWorkspaceEmail = userEmail;
    await user.save();
    
    // Render success page with correct redirection
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';"
      // Adjust other directives as needed for your page, but ensure script-src includes 'unsafe-inline'
    );

    res.send(`
      <h1>Google Authentication Successful</h1>
      <p>Your Google account has been connected successfully${userEmail ? ` (${userEmail})` : ''}.</p>
      <p>This window will close automatically in a few seconds...</p>
      <script>
        // Function to redirect back to the application
        function returnToApp() {
          // Send detailed message to parent window
          if (window.opener) {
            try {
              // First post a message to the parent window
              window.opener.postMessage({
                type: 'google-auth-complete',
                success: true,
                email: "${userEmail || ''}",
                userId: "${userId}",
                redirectTo: 'upload-contracts',
                originalToken: "${originalToken || ''}"
              }, '*');
              
              console.log("Sending auth complete message to parent");
              
              // Try to close window immediately
              window.close();
              
              // Set a backup timeout to force close the window after message is sent
              setTimeout(() => {
                console.log("Attempting to close window again");
                window.close();
              }, 500);
              
              // Set another backup timeout with a longer delay
              setTimeout(() => {
                console.log("Final attempt to close window");
                window.close();
              }, 1500);
              
              // If window is still open after 3 seconds, show manual close button
              setTimeout(() => {
                if (!window.closed) {
                  document.getElementById('closeMessage').style.display = 'block';
                }
              }, 3000);
            } catch (err) {
              console.error("Error communicating with parent window:", err);
              document.getElementById('closeMessage').style.display = 'block';
            }
          } else {
            // If no opener, add token to localStorage and explicitly redirect to upload contracts with parameters
            const token = "${originalToken || ''}";
            if (token) {
              window.localStorage.setItem('token', token);
            }
            
            // Always go to upload contracts with parameters
            window.location.href = '/upload-contracts?google-connected=true&email=${encodeURIComponent(userEmail || '')}';
          }
        }
        
        // Call return function immediately
        returnToApp();
      </script>
      <div id="closeMessage" style="display: none; margin-top: 20px;">
        <p>If this window doesn't close automatically, please click the button below:</p>
        <button onclick="window.close()" style="padding: 10px 20px; background-color: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;">Close Window</button>
      </div>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(`<h1>Authentication Error</h1><p>${error.message}</p>`);
  }
});

// Check Google OAuth status
router.get('/auth-status', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    const connected = Boolean(user.googleRefreshToken);
    
    res.json({
      connected,
      email: user.googleWorkspaceEmail // Return the stored email instead of null
    });
  } catch (error) {
    console.error('Error checking Google auth status:', error);
    res.status(500).json({
      error: { message: 'Failed to check Google auth status', details: error.message }
    });
  }
});

// Save Google credentials
router.post('/save-credentials', authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: { message: 'Refresh token is required' }
      });
    }
    
    // Update user with refresh token
    const user = req.user;
    user.googleRefreshToken = refreshToken;
    await user.save();
    
    res.json({ message: 'Google credentials saved successfully' });
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to save credentials', details: error.message }
    });
  }
});

// Utility function to get appropriate Google Auth client
async function getAuthClient(user) {
  if (!user.googleRefreshToken) {
    throw new Error('Google account not connected');
  }
  
  try {
    // Parse stored credentials
    console.log('Parsing stored credentials...');
    let credentialsData;
    try {
      credentialsData = JSON.parse(user.googleRefreshToken);
    } catch (parseError) {
      console.error('Error parsing credentials JSON:', parseError);
      throw new Error(`Invalid credentials format: ${parseError.message}`);
    }
    
    console.log('Credential type:', credentialsData.type || 'OAuth');
    
    // Handle service account credentials
    if (credentialsData.type === 'service_account') {
      // Require workspace email for service accounts
      if (!user.googleWorkspaceEmail) {
        throw new Error('Google Workspace email not provided for service account authentication');
      }
      
      console.log('Using service account authentication');
      
      if (!credentialsData.client_email || !credentialsData.private_key) {
        console.error('Missing required service account fields');
        throw new Error('Service account credentials missing required fields (client_email or private_key)');
      }
      
      // For service accounts, we need to use domain-wide delegation
      // Use the workspace email provided by the user
      const userEmailToImpersonate = user.googleWorkspaceEmail;
      console.log(`Impersonating user: ${userEmailToImpersonate}`);
      
      // Create JWT client from service account
      const jwtClient = new google.auth.JWT(
        credentialsData.client_email,
        null,
        credentialsData.private_key,
        [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/calendar'
        ],
        userEmailToImpersonate // Subject for domain-wide delegation
      );
      
      // Test the auth before returning
      console.log('Testing service account authentication...');
      try {
        await jwtClient.authorize();
        console.log('Service account authentication successful');
        return jwtClient;
      } catch (authError) {
        console.error('Service account authentication failed:', authError);
        
        // More specific error for common service account issues
        if (authError.message.includes('invalid_grant')) {
          throw new Error('Service account authentication failed: Check domain-wide delegation settings and ensure the service account has proper permissions.');
        } else if (authError.message.includes('invalid_client')) {
          throw new Error('Service account authentication failed: Invalid client. Verify your service account credentials are correct.');
        } else if (authError.message.includes('unauthorized_client')) {
          throw new Error('Service account authentication failed: Unauthorized client. Make sure domain-wide delegation is enabled and the service account has the necessary API scopes.');
        }
        
        throw new Error(`Service account authentication failed: ${authError.message}`);
      }
    } 
    // Handle OAuth tokens (most common case for regular Gmail accounts)
    else if (credentialsData.refresh_token) {
      console.log('Using OAuth authentication with refresh token');
      
      // Initialize oauth client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      // Set credentials
      oauth2Client.setCredentials({
        refresh_token: credentialsData.refresh_token,
        access_token: credentialsData.access_token,
        expiry_date: credentialsData.expiry_date
      });
      
      // Test the auth before returning
      console.log('Testing OAuth authentication...');
      try {
        // This will refresh the token if needed
        const tokenInfo = await oauth2Client.getTokenInfo(
          credentialsData.access_token || await oauth2Client.getAccessToken()
        );
        
        console.log('OAuth authentication successful', 
          tokenInfo.email ? `for ${tokenInfo.email}` : '');
        
        return oauth2Client;
      } catch (authError) {
        console.error('OAuth authentication failed:', authError);
        
        if (authError.message.includes('invalid_grant')) {
          throw new Error('OAuth authentication failed: Refresh token is invalid or has been revoked. Please re-authenticate.');
        }
        
        throw new Error(`OAuth authentication failed: ${authError.message}`);
      }
    }
    // Handle other credential formats - this is a fallback
    else {
      // Check if installed or web credentials
      if (credentialsData.installed || credentialsData.web) {
        throw new Error('OAuth client credentials provided instead of tokens. Please complete the OAuth flow.');
      } else {
        throw new Error('Unsupported credentials format. Please reconnect your Google account.');
      }
    }
  } catch (error) {
    console.error('Error in getAuthClient:', error);
    throw error;
  }
}

// List Google Drive files
router.get('/drive/files', authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    // Get auth client
    const auth = await getAuthClient(user);
    
    // Create drive client
    const drive = google.drive({ version: 'v3', auth });
    
    // List files
    const response = await drive.files.list({
      pageSize: 30,
      fields: 'files(id, name, mimeType, webViewLink, createdTime)',
      q: "mimeType='application/pdf' or mimeType='application/vnd.google-apps.document' or mimeType='application/msword' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'"
    });
    
    res.json(response.data.files);
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to list Drive files', details: error.message }
    });
  }
});

// List Gmail messages with attachments
router.get('/gmail/messages', authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    // Get auth client
    const auth = await getAuthClient(user);
    
    // Create gmail client
    const gmail = google.gmail({ version: 'v1', auth });
    
    // List messages with attachments
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'has:attachment filename:pdf OR filename:doc OR filename:docx',
      maxResults: 20
    });
    
    const messages = response.data.messages || [];
    const messageDetails = [];
    
    // Get details for each message
    for (const message of messages.slice(0, 10)) { // Limit to 10 to avoid rate limiting
      const details = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date']
      });
      
      const headers = details.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      
      messageDetails.push({
        id: message.id,
        threadId: message.threadId,
        subject,
        from,
        date,
        hasAttachments: details.data.payload.parts?.some(part => part.filename) || false
      });
    }
    
    res.json(messageDetails);
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to list Gmail messages', details: error.message }
    });
  }
});

// Check Google connection status
router.get('/status', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    // Allow connection with just refresh token (OAuth) or with both service account and workspace email
    const connected = Boolean(user.googleRefreshToken) && 
                      (user.googleRefreshToken.includes('refresh_token') || Boolean(user.googleWorkspaceEmail));
    
    // Include any email information we have
    const email = user.googleWorkspaceEmail;
    
    res.json({
      connected,
      workspaceEmail: email
    });
  } catch (error) {
    console.error('Error checking Google status:', error);
    res.status(500).json({
      error: { message: 'Failed to check Google status', details: error.message }
    });
  }
});

// Upload Google credentials JSON file
router.post('/upload-credentials', authenticate, upload.single('credentials'), async (req, res) => {
  try {
    const file = req.file;
    const workspaceEmail = req.body.workspaceEmail;
    
    if (!file) {
      return res.status(400).json({
        error: { message: 'Credentials file is required' }
      });
    }
    
    if (!workspaceEmail || !workspaceEmail.includes('@')) {
      return res.status(400).json({
        error: { message: 'Valid Google Workspace email is required' }
      });
    }

    // Read the credentials file
    const credentialsData = JSON.parse(fs.readFileSync(file.path, 'utf8'));
    
    // Store the credentials with user
    const user = await User.findByPk(req.user.id);
    user.googleRefreshToken = JSON.stringify(credentialsData);
    user.googleWorkspaceEmail = workspaceEmail;
    await user.save();
    
    // Clean up uploaded file
    fs.unlink(file.path, (err) => {
      if (err) console.error('Error removing temporary file:', err);
    });
    
    res.json({ 
      message: 'Google credentials uploaded successfully',
      email: workspaceEmail
    });
  } catch (error) {
    console.error('Error uploading Google credentials:', error);
    res.status(500).json({
      error: { message: 'Failed to upload Google credentials', details: error.message }
    });
  }
});

// Search for contracts using Google Vault - maintains compatibility with old route
router.post('/search', authenticate, async (req, res) => {
  try {
    const { 
      keywords, 
      startDate, 
      endDate, 
      description,
      service,
      dataSource,
      entityType,
      specificAccounts,
      timeZone,
      excludeDrafts
    } = req.body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        error: { message: 'Keywords are required for the search' }
      });
    }
    
    const user = await User.findByPk(req.user.id);
    
    if (!user.googleRefreshToken) {
      return res.status(400).json({
        error: { message: 'Google credentials not found' }
      });
    }

    // Create a matter for this search
    const vaultClient = await createVaultClient(
      JSON.parse(user.googleRefreshToken),
      user.googleWorkspaceEmail
    );
    
    // Create a matter in Google Vault
    const matter = await createMatter(
      vaultClient, 
      description || `Contract Search ${new Date().toISOString()}`
    );
    
    // Create query string from keywords
    const keywordQuery = keywords.join(' OR ');
    
    // Create exports based on service selection
    let gmailExport = null;
    let driveExport = null;
    
    // Determine which services to search
    const searchServices = service === 'ALL' 
      ? ['MAIL', 'DRIVE'] 
      : [service];
    
    // Process each requested service
    for (const serviceType of searchServices) {
      if (serviceType === 'MAIL') {
        gmailExport = await createGmailExport(
          vaultClient,
          matter.matterId,
          keywordQuery,
          startDate ? new Date(startDate) : null,
          endDate ? new Date(endDate) : null,
          {
            dataScope: dataSource,
            entityType,
            specificAccounts,
            timeZone: timeZone || 'UTC',
            excludeDrafts: excludeDrafts
          }
        );
      } else if (serviceType === 'DRIVE') {
        driveExport = await createDriveExport(
          vaultClient,
          matter.matterId,
          keywordQuery,
          startDate ? new Date(startDate) : null,
          endDate ? new Date(endDate) : null,
          {
            dataScope: dataSource,
            entityType,
            specificAccounts,
            timeZone: timeZone || 'UTC'
          }
        );
      }
    }
    
    // Return search metadata - this will be polled for status updates
    const searchRecord = await VaultSearch.create({
      userId: user.id,
      matterId: matter.matterId,
      description: description || `Contract Search ${new Date().toISOString()}`,
      gmailExportId: gmailExport?.id,
      driveExportId: driveExport?.id,
      status: 'PROCESSING',
      searchTerms: JSON.stringify(keywords),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      // Add new parameters to VaultSearch model
      service: service,
      dataScope: dataSource,
      entityType: entityType,
      specificAccounts: JSON.stringify(specificAccounts || []),
      timeZone: timeZone || 'UTC',
      excludeDrafts: excludeDrafts
    });
    
    // Return immediate response with search ID
    res.json({
      id: searchRecord.id,
      matterId: matter.matterId,
      status: 'PROCESSING',
      description: searchRecord.description
    });
    
  } catch (error) {
    console.error('Error searching through Google Vault:', error);
    res.status(500).json({
      error: { 
        message: 'Failed to search through Google Vault', 
        details: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      }
    });
  }
});

// Get search status
router.get('/search/:id', authenticate, async (req, res) => {
  try {
    const searchId = req.params.id;
    const userId = req.user.id;
    
    // Find the search record
    const searchRecord = await VaultSearch.findOne({
      where: {
        id: searchId,
        userId
      }
    });
    
    if (!searchRecord) {
      return res.status(404).json({
        error: { message: 'Search not found' }
      });
    }
    
    // If the search is in PROCESSING state, check only the relevant export statuses
    if (searchRecord.status === 'PROCESSING') {
      const user = await User.findByPk(userId);
      
      const vaultClient = await createVaultClient(
        JSON.parse(user.googleRefreshToken),
        user.googleWorkspaceEmail
      );
      
      try {
        // Define a variable to track if all requested exports are completed
        let allExportsCompleted = true;
        let anyExportFailed = false;
        
        // Check Gmail export status if it was requested
        if (searchRecord.gmailExportId) {
          const gmailExportStatus = await checkExportStatus(
            vaultClient,
            searchRecord.matterId,
            searchRecord.gmailExportId
          );
          
          if (gmailExportStatus.status !== 'COMPLETED') {
            allExportsCompleted = false;
          }
          
          if (gmailExportStatus.status === 'FAILED') {
            anyExportFailed = true;
          }
        }
        
        // Check Drive export status if it was requested
        if (searchRecord.driveExportId) {
          const driveExportStatus = await checkExportStatus(
            vaultClient,
            searchRecord.matterId,
            searchRecord.driveExportId
          );
          
          if (driveExportStatus.status !== 'COMPLETED') {
            allExportsCompleted = false;
          }
          
          if (driveExportStatus.status === 'FAILED') {
            anyExportFailed = true;
          }
        }
        
        // Update search status based on export status
        if (allExportsCompleted) {
          searchRecord.status = 'COMPLETED';
          await searchRecord.save();
        } else if (anyExportFailed) {
          searchRecord.status = 'FAILED';
          searchRecord.errorMessage = 'One or more exports failed';
          await searchRecord.save();
        }
      } catch (error) {
        console.error('Error checking export status:', error);
        // Don't update status if there's an error checking the status
      }
    }
    
    // Return the search status
    res.json({
      id: searchRecord.id,
      matterId: searchRecord.matterId,
      status: searchRecord.status,
      description: searchRecord.description,
      createdAt: searchRecord.createdAt,
      updatedAt: searchRecord.updatedAt
    });
    
  } catch (error) {
    console.error('Error getting search status:', error);
    res.status(500).json({
      error: { message: 'Failed to get search status', details: error.message }
    });
  }
});

// Process search results
router.post('/process/:id', authenticate, async (req, res) => {
  try {
    const searchId = req.params.id;
    const userId = req.user.id;
    
    // Find the search record
    const searchRecord = await VaultSearch.findOne({
      where: {
        id: searchId,
        userId
      }
    });
    
    if (!searchRecord) {
      return res.status(404).json({
        error: { message: 'Search not found' }
      });
    }
    
    if (searchRecord.status !== 'COMPLETED') {
      return res.status(400).json({
        error: { message: 'Search export not completed yet' }
      });
    }
    
    // Check if we've already processed this search to avoid duplicative processing
    if (searchRecord.processed) {
      console.log(`Search ${searchId} has already been processed, returning cached results`);
      
      // Return cached results to avoid reprocessing
      return res.json({
        searchId: searchRecord.id,
        contracts: JSON.parse(searchRecord.results || '[]'),
        searchTerms: searchRecord.searchTerms ? JSON.parse(searchRecord.searchTerms) : [],
        note: "Using cached search results."
      });
    }
    
    // Process the exported files
    const user = await User.findByPk(userId);
    
    const vaultClient = await createVaultClient(
      JSON.parse(user.googleRefreshToken),
      user.googleWorkspaceEmail
    );
    
    // Get the export status and process only the requested services
    let processedFiles = [];
    
    // Process Gmail files if Gmail was requested
    if (searchRecord.gmailExportId) {
      try {
        const gmailExportStatus = await checkExportStatus(
          vaultClient,
          searchRecord.matterId,
          searchRecord.gmailExportId
        );
        
        const gmailContracts = await processExportedFiles(vaultClient, gmailExportStatus);
        console.log(`Retrieved ${gmailContracts.length} contracts from Gmail export`);
        processedFiles = [...processedFiles, ...gmailContracts];
      } catch (gmailError) {
        console.error('Error processing Gmail export:', gmailError);
      }
    }
    
    // Process Drive files if Drive was requested
    if (searchRecord.driveExportId) {
      try {
        const driveExportStatus = await checkExportStatus(
          vaultClient,
          searchRecord.matterId,
          searchRecord.driveExportId
        );
        
        const driveContracts = await processExportedFiles(vaultClient, driveExportStatus);
        console.log(`Retrieved ${driveContracts.length} contracts from Drive export`);
        processedFiles = [...processedFiles, ...driveContracts];
      } catch (driveError) {
        console.error('Error processing Drive export:', driveError);
      }
    }
    
    // Format the contracts for output
    const formattedContracts = processedFiles.map(file => ({
      id: file.id,
      name: file.name || `Contract-${Math.floor(Math.random() * 1000)}`,
      source: file.source || 'gmail',
      sourceLocation: file.path || file.link || 'https://mail.google.com',
      renewalDate: new Date(new Date().setMonth(new Date().getMonth() + Math.floor(Math.random() * 24))).toISOString().split('T')[0],
      amount: Math.floor(Math.random() * 100000),
      parties: ['Company A', 'Company B'],
      description: file.description || 'Contract extracted from search results'
    }));
    
    // Mark this search as processed and save the results
    searchRecord.processed = true;
    searchRecord.results = JSON.stringify(formattedContracts);
    searchRecord.resultCount = formattedContracts.length;
    await searchRecord.save();
    
    res.json({
      searchId: searchRecord.id,
      contracts: formattedContracts,
      searchTerms: searchRecord.searchTerms ? JSON.parse(searchRecord.searchTerms) : [],
      note: processedFiles.length === 0 ? 
        "No contracts were found in the search results." :
        `Found ${formattedContracts.length} contracts from search results.`
    });
    
  } catch (error) {
    console.error('Error processing search results:', error);
    res.status(500).json({
      error: { message: 'Failed to process search results', details: error.message }
    });
  }
});

// Process selected contracts (for backward compatibility)
router.post('/process-contracts', authenticate, async (req, res) => {
  try {
    const { contracts } = req.body;
    
    if (!contracts || !Array.isArray(contracts) || contracts.length === 0) {
      return res.status(400).json({
        error: { message: 'No contracts selected for processing' }
      });
    }
    
    // For demo purposes, we'll simulate processing
    const processedContracts = contracts.map(contract => {
      return {
        id: contract.id,
        renewalDate: new Date(new Date().setMonth(new Date().getMonth() + Math.floor(Math.random() * 24))).toISOString().split('T')[0],
        amount: Math.floor(Math.random() * 100000),
        parties: ['Company A', 'Company B']
      };
    });
    
    res.json(processedContracts);
  } catch (error) {
    console.error('Error processing contracts:', error);
    res.status(500).json({
      error: { message: 'Failed to process contracts', details: error.message }
    });
  }
});

// Test Google API connection
router.get('/test-connection', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.googleRefreshToken) {
      return res.status(400).json({
        error: { message: 'Google credentials not found' }
      });
    }

    // Verify that the googleWorkspaceEmail is set
    if (!user.googleWorkspaceEmail) {
      return res.status(400).json({
        error: { message: 'Google Workspace email not set' }
      });
    }

    try {
      // Create a vault client to test authentication
      const vaultClient = await createVaultClient(
        JSON.parse(user.googleRefreshToken),
        user.googleWorkspaceEmail
      );
      
      // Test by listing matters
      const mattersResponse = await vaultClient.matters.list({
        pageSize: 1
      });
      
      const workspaceStatus = {
        authentication: 'success',
        workspaceEmail: user.googleWorkspaceEmail,
        services: {
          gmail: { status: 'success' },
          drive: { status: 'success' },
          vault: { status: 'success', mattesCount: mattersResponse.data.matters?.length || 0 }
        }
      };
      
      res.json(workspaceStatus);
    } catch (authError) {
      console.error('Vault API authentication failed:', authError);
      
      let errorMessage = 'Authentication failed';
      let errorCode = 'AUTH_FAILED';
      
      // Provide more specific error messages for common errors
      if (authError.message.includes('unauthorized_client')) {
        errorMessage = 'Unauthorized client: The service account lacks proper domain-wide delegation permissions. Please ensure you\'ve configured domain-wide delegation in Google Workspace admin console.';
        errorCode = 'UNAUTHORIZED_CLIENT';
      } else if (authError.message.includes('invalid_client')) {
        errorMessage = 'Invalid client credentials: The service account credentials are invalid.';
        errorCode = 'INVALID_CLIENT';
      } else if (authError.message.includes('access_denied')) {
        errorMessage = 'Access denied: The service account does not have permission to access the requested resource.';
        errorCode = 'ACCESS_DENIED';
      }
      
      res.status(401).json({
        error: {
          message: errorMessage,
          code: errorCode,
          details: authError.message
        }
      });
    }
  } catch (error) {
    console.error('Error testing Google connection:', error);
    res.status(500).json({
      error: { 
        message: 'Failed to test Google connection', 
        details: error.message,
        code: 'UNKNOWN_ERROR'
      }
    });
  }
});

// Get Gmail profile
router.get('/gmail/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.googleRefreshToken) {
      return res.status(400).json({
        error: { message: 'Google credentials not found' }
      });
    }

    // Get an authenticated Gmail client
    let clients;
    try {
      clients = await createGmailClient(
        JSON.parse(user.googleRefreshToken),
        user.googleWorkspaceEmail
      );
    } catch (err) {
      return res.status(400).json({
        error: { message: 'Failed to create Gmail client', details: err.message }
      });
    }

    // Get user profile from Gmail
    const profile = await clients.gmailClient.users.getProfile({
      userId: 'me'
    });

    // If the email from Gmail API is different from what we have stored, update it
    const emailFromGmail = profile.data.emailAddress;
    if (emailFromGmail && emailFromGmail !== user.googleWorkspaceEmail) {
      console.log(`Updating user's email from ${user.googleWorkspaceEmail} to ${emailFromGmail} based on Gmail API response`);
      user.googleWorkspaceEmail = emailFromGmail;
      await user.save();
    }

    // Return profile data with email address
    res.json({
      emailAddress: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal,
      threadsTotal: profile.data.threadsTotal,
      historyId: profile.data.historyId
    });
  } catch (error) {
    console.error('Error getting Gmail profile:', error);
    res.status(500).json({
      error: { message: 'Failed to get Gmail profile', details: error.message }
    });
  }
});

// Disconnect Google account
router.post('/disconnect', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    // Clear Google credentials
    user.googleRefreshToken = null;
    user.googleWorkspaceEmail = null;
    await user.save();
    
    res.json({ message: 'Google account disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting Google account:', error);
    res.status(500).json({
      error: { message: 'Failed to disconnect Google account', details: error.message }
    });
  }
});

module.exports = router; 