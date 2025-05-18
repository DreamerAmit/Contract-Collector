const { google } = require('googleapis');
const { analyzeDocument } = require('./openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Creates an authenticated Google Gmail API client
 * @param {Object} credentialsData - OAuth tokens or Service account credentials
 * @param {String} userEmail - Email to impersonate (only for service accounts)
 * @returns {Object} Authorized Gmail API client
 */
async function createGmailClient(credentialsData, userEmail) {
  let authClient;
  let actualEmail = userEmail; // Default to provided email
  
  try {
    // For service account
    if (credentialsData.type === 'service_account') {
      console.log('Creating Gmail client with service account');
      authClient = new google.auth.JWT(
        credentialsData.client_email,
        null,
        credentialsData.private_key,
        [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/drive.readonly'
        ],
        userEmail
      );
      // Only call authorize() for JWT clients
      await authClient.authorize(); 
    } 
    // For OAuth2 client
    else if (credentialsData.refresh_token) {
      console.log('Creating Gmail client with OAuth credentials');
      authClient = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      authClient.setCredentials({
        refresh_token: credentialsData.refresh_token,
        access_token: credentialsData.access_token,
        expiry_date: credentialsData.expiry_date
      });
      
      // DO NOT call authClient.authorize() here for OAuth2
      // Instead, refresh the token if needed:
      try {
        const tokenInfo = await authClient.getAccessToken();
        console.log('OAuth2 access token refreshed if needed');
        
        if (tokenInfo && tokenInfo.token) {
          const info = await authClient.getTokenInfo(tokenInfo.token);
          if (info && info.email) {
            console.log('Retrieved email from OAuth token:', info.email);
            actualEmail = info.email;
          }
        }
      } catch (tokenErr) {
        console.error('Error refreshing token:', tokenErr);
        // Continue anyway as googleapis will handle token refresh automatically
      }
    } else {
      throw new Error('Invalid credentials: Must provide either service account or OAuth credentials');
    }

    // Create API clients - THIS IS CRITICAL
    if (!authClient) {
      throw new Error('Auth client initialization failed');
    }
    
    // Initialize the Gmail client
    const gmailClient = google.gmail({ version: 'v1', auth: authClient });
    
    // Test that the client works by making a simple API call
    try {
      // Make a simple API call to verify the client works
      await gmailClient.users.getProfile({ userId: 'me' });
      console.log('Gmail client successfully initialized and tested');
    } catch (testErr) {
      console.error('Error testing Gmail client:', testErr);
      throw new Error(`Gmail client failed initial test: ${testErr.message}`);
    }
    
    // Initialize the Drive client
    const driveClient = google.drive({ version: 'v3', auth: authClient });
    
    console.log('Returning clients object with gmailClient, driveClient, auth and email');
    
    // Return the complete clients object
    return {
      gmailClient,  // This property name must match what searchGmailForContracts expects
      driveClient,
      auth: authClient,
      email: actualEmail
    };
  } catch (error) {
    console.error('Error in createGmailClient:', error);
    throw error; // Rethrow so the caller can handle it
  }
}

/**
 * Helper function to get header from message
 * @param {Array} headers - Message headers
 * @param {String} name - Header name
 * @returns {String} Header value
 */
function getHeader(headers, name) {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

/**
 * Helper function to get attachments from message
 * @param {Object} payload - Message payload
 * @returns {Array} Attachments
 */
function getAttachments(payload) {
  const attachments = [];
  
  function processPayload(payload) {
    // Check if this part has attachments
    if (payload.body && payload.body.attachmentId && payload.filename) {
      attachments.push({
        id: payload.body.attachmentId,
        filename: payload.filename,
        mimeType: payload.mimeType,
        size: payload.body.size
      });
    }
    
    // Recursively process parts
    if (payload.parts) {
      payload.parts.forEach(processPayload);
    }
  }
  
  processPayload(payload);
  return attachments;
}

/**
 * Search Gmail for contracts
 * @param {Object} gmailClient - Gmail API client
 * @param {String} query - Search query
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} options - Additional options
 * @returns {Object} Search results
 */
async function searchGmailForContracts(gmailClient, query, startDate, endDate, options = {}) {
  // Validate gmailClient directly
  if (!gmailClient) {
    throw new Error('Invalid gmailClient: missing');
  }
  
  // Also validate gmailClient has the expected methods
  if (!gmailClient.users || !gmailClient.users.messages) {
    throw new Error('Invalid gmailClient: missing users.messages API');
  }
  
  // Extract search keywords for matching later
  const searchKeywords = query.toLowerCase().split(' OR ').map(k => k.trim());
  
  // Format date range for Gmail query
  let dateQuery = '';
  if (startDate) dateQuery += ` after:${startDate.toISOString().split('T')[0].replace(/-/g, '/')}`;
  if (endDate) dateQuery += ` before:${endDate.toISOString().split('T')[0].replace(/-/g, '/')}`;
  
  // Build full query
  let fullQuery = `${query}${dateQuery}`;
  
  // Add attachment filter if needed
  if (options.attachmentsOnly) {
    fullQuery += ' has:attachment';
  }
  
  // Exclude drafts if specified
  if (options.excludeDrafts) {
    fullQuery += ' -is:draft';
  }
  
  console.log(`Searching Gmail with query: ${fullQuery}`);
  
  try {
    // Initial search request
    const searchResponse = await gmailClient.users.messages.list({
      userId: 'me',
      q: fullQuery,
      maxResults: options.maxResults || 100
    });
    
    const messages = searchResponse.data.messages || [];
    console.log(`Found ${messages.length} potential contract emails`);
    
    // Track our progress for the frontend
    const searchId = `gmail-${Date.now()}`;
    const results = {
      id: searchId,
      status: 'PROCESSING',
      totalMessages: messages.length,
      processedMessages: 0,
      contracts: []
    };
    
    // Process messages in batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      // Process each message in the batch
      const batchResults = await Promise.all(
        batch.map(async (message) => {
          try {
            const details = await gmailClient.users.messages.get({
              userId: 'me',
              id: message.id,
              format: 'full'
            });
            
            // Extract message data
            const subject = getHeader(details.data.payload.headers, 'Subject');
            const from = getHeader(details.data.payload.headers, 'From');
            const date = getHeader(details.data.payload.headers, 'Date');
            const attachments = getAttachments(details.data.payload);
            
            // Check if this looks like a contract or matches our search keywords
            const isLikelyContract = 
              subject.toLowerCase().includes('contract') || 
              subject.toLowerCase().includes('agreement') ||
              attachments.some(a => 
                a.filename.toLowerCase().includes('contract') || 
                a.filename.toLowerCase().includes('agreement')
              ) ||
              // Also match on the search keywords
              searchKeywords.some(keyword => 
                subject.toLowerCase().includes(keyword) ||
                attachments.some(a => a.filename.toLowerCase().includes(keyword))
              );
            
            if (isLikelyContract || options.includeAll) {
              // Process attachments to extract contract information
              console.log(`Processing attachments for message: ${message.id}`);
              const contractInfo = await processAttachmentsForContractInfo(gmailClient, message.id, attachments);
              
              return {
                id: message.id,
                name: subject || 'Unnamed Contract',
                subject,
                from,
                date,
                source: 'gmail',
                sourceLocation: `https://mail.google.com/mail/#inbox/${message.id}`,
                renewalDate: contractInfo.renewalDate, // Use extracted renewal date
                amount: contractInfo.amount, // Use extracted amount
                parties: contractInfo.parties.length > 0 
                  ? contractInfo.parties 
                  : [from.split('<')[0].trim()], // Use extracted parties or default to sender
                hasAttachments: attachments.length > 0,
                attachments
              };
            }
            
            return null;
          } catch (error) {
            console.error(`Error processing message ${message.id}:`, error);
            return null;
          }
        })
      );
      
      // Filter out null results and add to contracts
      const validResults = batchResults.filter(r => r !== null);
      results.contracts.push(...validResults);
      results.processedMessages += batch.length;
      
      // Update status
      results.status = i + batchSize >= messages.length ? 'COMPLETED' : 'PROCESSING';
      
      // Sleep between batches to avoid rate limits
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  } catch (error) {
    console.error('Gmail search error:', error);
    throw error;
  }
}

/**
 * Search Google Drive for contracts
 * @param {Object} clients - Gmail and Drive API clients
 * @param {String} query - Search query
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} options - Additional options
 * @returns {Object} Search results
 */
async function searchDriveForContracts(clients, query, startDate, endDate, options = {}) {
  const { driveClient } = clients;
  
  // Build Google Drive query
  // Note: Drive API has different query syntax from Gmail
  let driveQuery = `fullText contains '${query}'`;
  
  // Add date filters if provided
  if (startDate) {
    driveQuery += ` and modifiedTime >= '${startDate.toISOString()}'`;
  }
  
  if (endDate) {
    driveQuery += ` and modifiedTime <= '${endDate.toISOString()}'`;
  }
  
  // Add file type filters
  driveQuery += " and (mimeType='application/pdf' or mimeType='application/vnd.google-apps.document' or mimeType contains 'word')";
  
  console.log(`Searching Drive with query: ${driveQuery}`);
  
  try {
    const searchResponse = await driveClient.files.list({
      q: driveQuery,
      fields: 'files(id, name, mimeType, webViewLink, createdTime, modifiedTime, owners)',
      pageSize: options.maxResults || 100
    });
    
    const files = searchResponse.data.files || [];
    console.log(`Found ${files.length} potential contract files`);
    
    // Format results similar to Gmail results
    const contracts = files.map(file => ({
      id: file.id,
      name: file.name || 'Unnamed Document',
      subject: file.name,
      from: file.owners?.[0]?.displayName || 'Unknown',
      date: file.createdTime,
      source: 'drive',
      sourceLocation: file.webViewLink,
      renewalDate: null, // To be determined by further analysis
      amount: null, // To be determined by further analysis
      parties: [], // To be determined by further analysis
      hasAttachments: false,
      mimeType: file.mimeType
    }));
    
    return {
      id: `drive-${Date.now()}`,
      status: 'COMPLETED',
      totalFiles: files.length,
      contracts
    };
  } catch (error) {
    console.error('Drive search error:', error);
    throw error;
  }
}

/**
 * Download attachment from Gmail
 * @param {Object} gmailClient - Gmail API client
 * @param {String} messageId - Message ID
 * @param {String} attachmentId - Attachment ID
 * @returns {Buffer} - Attachment content
 */
async function downloadAttachment(gmailClient, messageId, attachmentId) {
  try {
    const response = await gmailClient.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId
    });
    
    if (!response.data.data) {
      throw new Error('No attachment data found');
    }
    
    // Convert base64 to buffer
    const attachmentData = Buffer.from(response.data.data, 'base64');
    return attachmentData;
  } catch (error) {
    console.error(`Error downloading attachment ${attachmentId}:`, error);
    throw error;
  }
}

/**
 * Extract text from attachment based on mime type
 * @param {Buffer} attachmentData - Attachment content
 * @param {String} mimeType - MIME type of attachment
 * @param {String} filename - Filename of attachment
 * @returns {String} - Extracted text
 */
async function extractTextFromAttachment(attachmentData, mimeType, filename) {
  try {
    // For text-based files, just convert buffer to string
    if (mimeType.includes('text/') || 
        mimeType.includes('application/json') || 
        mimeType.includes('application/xml')) {
      return attachmentData.toString('utf8');
    }
    
    // For PDF files
    if (mimeType === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      try {
        const data = await pdfParse(attachmentData);
        return data.text;
      } catch (pdfError) {
        console.error(`Error parsing PDF file ${filename}:`, pdfError);
        return `[Error parsing PDF: ${pdfError.message}]`;
      }
    }
    
    // For Word documents
    if (mimeType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      // Modern DOCX files
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: attachmentData });
        return result.value || `[No text content extracted from DOCX file ${filename}]`;
      } catch (docxError) {
        console.error(`Error parsing DOCX file ${filename}:`, docxError);
        return `[Error parsing DOCX: ${docxError.message}]`;
      }
    }
    
    // For older Word documents (DOC format)
    if (mimeType.includes('application/msword')) {
      // Older DOC files are more challenging to parse in Node.js
      // Consider using a conversion service or library for these
      return `[Content from DOC file ${filename} - consider installing a DOC parser library]`;
    }
    
    // For other file types, return a placeholder
    return `[Content extraction not supported for ${mimeType}: ${filename}]`;
  } catch (error) {
    console.error(`Error extracting text from attachment ${filename}:`, error);
    return `[Error extracting text: ${error.message}]`;
  }
}

/**
 * Process attachments of an email to extract contract information
 * @param {Object} gmailClient - Gmail API client
 * @param {String} messageId - Message ID
 * @param {Array} attachments - List of attachments
 * @returns {Object} - Contract information
 */
async function processAttachmentsForContractInfo(gmailClient, messageId, attachments) {
  // Default contract info
  const contractInfo = {
    renewalDate: null,
    amount: null,
    parties: []
  };
  
  // If no attachments, return default info
  if (!attachments || attachments.length === 0) {
    return contractInfo;
  }
  
  // Process each attachment
  for (const attachment of attachments) {
    try {
      // Only process attachments that might contain contract info (PDFs, Word docs, text files)
      const supportedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument', 'text/'];
      
      if (!supportedTypes.some(type => attachment.mimeType.includes(type))) {
        continue;
      }
      
      // Download attachment
      const attachmentData = await downloadAttachment(gmailClient, messageId, attachment.id);
      
      // Extract text from attachment
      const text = await extractTextFromAttachment(attachmentData, attachment.mimeType, attachment.filename);
      
      // If we have text, analyze it with OpenAI
      if (text && text.length > 0) {
        const analysis = await analyzeDocument(text);
        
        // Update contract info with any new information
        if (analysis.renewalDate) contractInfo.renewalDate = analysis.renewalDate;
        if (analysis.amount) contractInfo.amount = analysis.amount;
        if (analysis.parties && analysis.parties.length > 0) {
          contractInfo.parties = Array.from(new Set([...contractInfo.parties, ...analysis.parties]));
        }
      }
    } catch (error) {
      console.error(`Error processing attachment ${attachment.filename}:`, error);
      // Continue with other attachments
    }
  }
  
  return contractInfo;
}

// Export all functions
module.exports = {
  createGmailClient,
  searchGmailForContracts,
  searchDriveForContracts,
  getHeader,
  getAttachments,
  downloadAttachment,
  extractTextFromAttachment,
  processAttachmentsForContractInfo
}; 