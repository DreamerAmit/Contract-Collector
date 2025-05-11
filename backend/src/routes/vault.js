const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { User, VaultSearch } = require('../models');
const { 
  createVaultClient, 
  createMatter, 
  createEmailExport,
  createDriveExport,
  checkExportStatus,
  listExports,
  processExportedFiles
} = require('../utils/vaultClient');

/**
 * Start a new Vault eDiscovery search
 */
router.post('/search', authenticate, async (req, res) => {
  try {
    const { description, keywords, startDate, endDate } = req.body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        error: { message: 'Keywords are required for the search' }
      });
    }
    
    const user = await User.findByPk(req.user.id);
    
    if (!user.googleRefreshToken || !user.googleWorkspaceEmail) {
      return res.status(400).json({
        error: { message: 'Google Workspace account not properly configured' }
      });
    }
    
    // Parse stored credentials
    let credentialsData;
    try {
      credentialsData = JSON.parse(user.googleRefreshToken);
    } catch (error) {
      return res.status(400).json({
        error: { message: 'Invalid Google credentials format' }
      });
    }
    
    // Initialize Vault API client
    const vaultClient = await createVaultClient(
      credentialsData,
      user.googleWorkspaceEmail
    );
    
    // Create a new matter
    const matter = await createMatter(vaultClient, description || 'Contract search');
    
    // Create query string from keywords
    const queryString = keywords.join(' OR ');
    
    // Create exports for both Gmail and Drive (directly, without holds)
    const gmailExport = await createEmailExport(
      vaultClient,
      matter.matterId,
      queryString,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );
    
    const driveExport = await createDriveExport(
      vaultClient,
      matter.matterId,
      queryString,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );
    
    // Save the search information
    const vaultSearch = await VaultSearch.create({
      userId: user.id,
      matterId: matter.matterId,
      description: description || 'Contract search',
      gmailExportId: gmailExport.id,
      driveExportId: driveExport.id,
      status: 'PROCESSING',
      searchTerms: JSON.stringify(keywords),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    });
    
    res.json({
      id: vaultSearch.id,
      matterId: matter.matterId,
      status: 'PROCESSING',
      message: 'Vault search started successfully'
    });
  } catch (error) {
    console.error('Vault search error:', error);
    res.status(500).json({
      error: { message: 'Failed to start Vault search', details: error.message }
    });
  }
});

/**
 * Get the status of an ongoing Vault search
 */
router.get('/search/:id', authenticate, async (req, res) => {
  try {
    const vaultSearch = await VaultSearch.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!vaultSearch) {
      return res.status(404).json({
        error: { message: 'Vault search not found' }
      });
    }
    
    // If search is still processing, check the current status
    if (vaultSearch.status === 'PROCESSING') {
      const user = await User.findByPk(req.user.id);
      
      let credentialsData;
      try {
        credentialsData = JSON.parse(user.googleRefreshToken);
      } catch (error) {
        return res.status(400).json({
          error: { message: 'Invalid Google credentials format' }
        });
      }
      
      // Initialize Vault API client
      const vaultClient = await createVaultClient(
        credentialsData,
        user.googleWorkspaceEmail
      );
      
      // Check status of Gmail export
      const gmailExportStatus = await checkExportStatus(
        vaultClient,
        vaultSearch.matterId,
        vaultSearch.gmailExportId
      );
      
      // Check status of Drive export
      const driveExportStatus = await checkExportStatus(
        vaultClient,
        vaultSearch.matterId,
        vaultSearch.driveExportId
      );
      
      // Update status based on both exports
      if (gmailExportStatus.status === 'COMPLETED' && driveExportStatus.status === 'COMPLETED') {
        vaultSearch.status = 'COMPLETED';
        await vaultSearch.save();
      } else if (gmailExportStatus.status === 'FAILED' || driveExportStatus.status === 'FAILED') {
        vaultSearch.status = 'FAILED';
        vaultSearch.errorMessage = 'One or more exports failed';
        await vaultSearch.save();
      }
    }
    
    res.json({
      id: vaultSearch.id,
      matterId: vaultSearch.matterId,
      status: vaultSearch.status,
      description: vaultSearch.description,
      searchTerms: vaultSearch.searchTerms,
      startDate: vaultSearch.startDate,
      endDate: vaultSearch.endDate,
      resultCount: vaultSearch.resultCount,
      createdAt: vaultSearch.createdAt
    });
  } catch (error) {
    console.error('Vault status error:', error);
    res.status(500).json({
      error: { message: 'Failed to get Vault search status', details: error.message }
    });
  }
});

/**
 * Process the results of a completed Vault search
 */
router.post('/process/:id', authenticate, async (req, res) => {
  try {
    const vaultSearch = await VaultSearch.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!vaultSearch) {
      return res.status(404).json({
        error: { message: 'Vault search not found' }
      });
    }
    
    if (vaultSearch.status !== 'COMPLETED') {
      return res.status(400).json({
        error: { message: 'Vault search is not completed yet' }
      });
    }
    
    const user = await User.findByPk(req.user.id);
    
    let credentialsData;
    try {
      credentialsData = JSON.parse(user.googleRefreshToken);
    } catch (error) {
      return res.status(400).json({
        error: { message: 'Invalid Google credentials format' }
      });
    }
    
    // Initialize Vault API client
    const vaultClient = await createVaultClient(
      credentialsData,
      user.googleWorkspaceEmail
    );
    
    // Get export statuses to get file information
    const gmailExportStatus = await checkExportStatus(
      vaultClient,
      vaultSearch.matterId,
      vaultSearch.gmailExportId
    );
    
    const driveExportStatus = await checkExportStatus(
      vaultClient,
      vaultSearch.matterId,
      vaultSearch.driveExportId
    );
    
    // Process the files from both exports
    const gmailContractsData = await processExportedFiles(
      vaultClient,
      gmailExportStatus
    );
    
    const driveContractsData = await processExportedFiles(
      vaultClient,
      driveExportStatus
    );
    
    // Combine results
    const contractsData = [...gmailContractsData, ...driveContractsData];
    
    // Update the search with result count
    vaultSearch.resultCount = contractsData.length;
    await vaultSearch.save();
    
    res.json({
      id: vaultSearch.id,
      contracts: contractsData,
      count: contractsData.length
    });
  } catch (error) {
    console.error('Vault processing error:', error);
    res.status(500).json({
      error: { message: 'Failed to process Vault search results', details: error.message }
    });
  }
});

/**
 * List all Vault searches for the user
 */
router.get('/searches', authenticate, async (req, res) => {
  try {
    const searches = await VaultSearch.findAll({
      where: {
        userId: req.user.id
      },
      order: [['createdAt', 'DESC']]
    });
    
    res.json(searches);
  } catch (error) {
    console.error('List Vault searches error:', error);
    res.status(500).json({
      error: { message: 'Failed to list Vault searches', details: error.message }
    });
  }
});

module.exports = router; 