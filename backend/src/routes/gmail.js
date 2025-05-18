const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { User, VaultSearch } = require('../models');
const { 
  createGmailClient,
  searchGmailForContracts,
  searchDriveForContracts
} = require('../utils/gmailClient');

/**
 * Search for contracts using Gmail API
 */
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
      excludeDrafts,
      includeAllMatches
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

    // Create query string from keywords
    const keywordQuery = keywords.join(' OR ');
    
    try {
      // Create search record first
      const searchRecord = await VaultSearch.create({
        userId: user.id,
        description: description || 'Contract Search',
        searchTerms: JSON.stringify(keywords),
        status: 'PROCESSING',
        startDate: startDate || null,
        endDate: endDate || null
      });
      
      // Get Gmail client - handles both OAuth and service account authentication
      const credentialsData = JSON.parse(user.googleRefreshToken);
      const clients = await createGmailClient(
        credentialsData,
        user.googleWorkspaceEmail // Will be used only for service accounts
      );
      
      // Add this explicit check
      if (!clients || !clients.gmailClient) {
        throw new Error('Gmail client creation failed: invalid return structure');
      }
      
      console.log('Clients object created successfully:', 
                  Object.keys(clients).join(', ')); // Log keys without exposing sensitive data
      
      // Start search in background to avoid timeouts
      // Return the search ID immediately
      res.json({
        id: searchRecord.id,
        matterId: null, // Not using Vault API
        status: 'PROCESSING',
        description: searchRecord.description
      });
      
      // Perform search based on service type
      let searchResults;
      
      // Perform asynchronous processing
      (async () => {
        try {
          // Explicitly verify clients again before search
          if (!clients || !clients.gmailClient) {
            throw new Error('Gmail client is undefined or invalid');
          }
          
          if (service === 'MAIL' || service === 'ALL') {
            // Search Gmail
            searchResults = await searchGmailForContracts(
              clients.gmailClient,
              keywordQuery,
              startDate ? new Date(startDate) : null,
              endDate ? new Date(endDate) : null,
              {
                excludeDrafts: excludeDrafts !== false,
                includeAll: includeAllMatches === true,
                maxResults: 100 // Limit for performance
              }
            );
          } else if (service === 'DRIVE') {
            // Search Drive
            searchResults = await searchDriveForContracts(
              clients.driveClient,
              keywordQuery,
              startDate ? new Date(startDate) : null,
              endDate ? new Date(endDate) : null
            );
          }
          
          // Update search record with results
          if (searchResults) {
            searchRecord.status = 'COMPLETED';
            searchRecord.results = JSON.stringify(searchResults.contracts || []);
            searchRecord.resultCount = (searchResults.contracts || []).length;
            await searchRecord.save();
          }
        } catch (searchError) {
          console.error('Error in background search process:', searchError);
          searchRecord.status = 'FAILED';
          searchRecord.error = searchError.message;
          await searchRecord.save();
        }
      })();
      
    } catch (error) {
      console.error('Error during search execution:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error starting search:', error);
    
    // If we get a specific Google API error, return it
    if (error.message.includes('invalid_grant')) {
      return res.status(401).json({
        error: { 
          message: 'Google authentication failed',
          details: 'Your Google access has expired. Please reconnect your Google account.'
        }
      });
    }
    
    res.status(500).json({
      error: { message: 'Failed to start search', details: error.message }
    });
  }
});

/**
 * Get search status - compatible with existing frontend
 */
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
    
    // Return the search status - same format as Vault API
    res.json({
      id: searchRecord.id,
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

/**
 * Process search results - compatible with existing frontend
 */
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
        error: { message: 'Search not completed yet' }
      });
    }
    
    // Results are already stored in the database
    const contractsData = JSON.parse(searchRecord.results || '[]');
    
    res.json({
      searchId: searchRecord.id,
      contracts: contractsData,
      searchTerms: searchRecord.searchTerms ? JSON.parse(searchRecord.searchTerms) : [],
      note: contractsData.length === 0 ? 
        "No contracts were found in the search results." :
        `Found ${contractsData.length} contracts from search results.`
    });
    
  } catch (error) {
    console.error('Error processing search results:', error);
    res.status(500).json({
      error: { message: 'Failed to process search results', details: error.message }
    });
  }
});

module.exports = router; 