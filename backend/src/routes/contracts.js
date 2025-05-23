const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { Contract } = require('../models');
const { extractTextFromDocument } = require('../utils/documentProcessor');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
  fileFilter: function(req, file, cb) {
    // Accept PDFs, Word docs, and other document types
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.oasis.opendocument.text',
      'text/plain'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, and text documents are allowed.'));
    }
  }
});

// Create a new contract with uploaded file
router.post('/', authenticate, upload.single('contractFile'), async (req, res) => {
  try {
    const { name, contentType, sourceEmail, sourceDriveId } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        error: { message: 'Contract file is required' }
      });
    }

    // Extract text from document
    const filePath = file.path;
    const extractedText = await extractTextFromDocument(filePath, contentType || file.mimetype);
    
    // Create contract record
    const contract = await Contract.create({
      name,
      filePath: filePath,
      contentType: contentType || file.mimetype,
      sourceEmail,
      sourceDriveId,
      extractedText,
      userId: req.user.id
    });
    
    res.status(201).json(contract);
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to create contract', details: error.message }
    });
  }
});

// Get all contracts for the current user
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 100;
    const offset = page * limit;
    
    // Use direct SQL query to avoid Sequelize model validation issues
    const query = `
      SELECT id, name, contractValue, renewalDate, userId, createdAt, updatedAt 
      FROM contracts 
      WHERE userId = :userId
      ORDER BY renewalDate DESC
      LIMIT :limit OFFSET :offset
    `;
    
    const contracts = await sequelize.query(query, {
      replacements: {
        userId: req.user.id,
        limit: limit,
        offset: offset
      },
      type: QueryTypes.SELECT
    });
    
    console.log('Contracts found:', contracts.length);
    
    // Transform the data to match what the frontend expects
    const formattedContracts = contracts.map(contract => ({
      id: contract.id,
      name: contract.name,
      contractValue: contract.contractvalue || contract.contractValue,
      renewalDate: contract.renewaldate || contract.renewalDate
    }));
    
    res.json(formattedContracts);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({
      error: { message: 'Failed to get contracts', details: error.message }
    });
  }
});

// Get a specific contract by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const contract = await Contract.findOne({
      where: {
        id: id,
        userId: req.user.id
      }
    });
    
    if (!contract) {
      return res.status(404).json({
        error: { message: 'Contract not found' }
      });
    }
    
    res.json(contract);
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to get contract', details: error.message }
    });
  }
});

// Update a contract
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contractValue, renewalDate } = req.body;
    
    const contract = await Contract.findOne({
      where: {
        id: id,
        userId: req.user.id
      }
    });
    
    if (!contract) {
      return res.status(404).json({
        error: { message: 'Contract not found' }
      });
    }
    
    // Update fields
    if (name) contract.name = name;
    if (contractValue !== undefined) contract.contractValue = contractValue;
    if (renewalDate) contract.renewalDate = renewalDate;
    
    await contract.save();
    
    res.json(contract);
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to update contract', details: error.message }
    });
  }
});

// Delete a contract
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`DELETE CONTRACT: Starting deletion process for contract ID ${id}`);
    
    // Use direct SQL query as a workaround for column case sensitivity issues
    const query = `
      DELETE FROM contracts 
      WHERE id = :id AND userid = :userid
      RETURNING id
    `;
    
    const result = await sequelize.query(query, {
      replacements: {
        id: id,
        userid: req.user.id
      },
      type: QueryTypes.DELETE
    });
    
    console.log(`DELETE CONTRACT: Result of deletion:`, result);
    
    if (result && result[0] && result[0].length > 0) {
      console.log(`DELETE CONTRACT: Successfully deleted contract ${id}`);
      res.json({ message: 'Contract deleted successfully' });
    } else {
      console.log(`DELETE CONTRACT: No contract found with ID ${id} for user ${req.user.id}`);
      res.status(404).json({
        error: { message: 'Contract not found or already deleted' }
      });
    }
  } catch (error) {
    console.error(`DELETE CONTRACT: Error during deletion:`, error);
    res.status(500).json({
      error: { message: 'Failed to delete contract', details: error.message }
    });
  }
});

// Batch upload contracts
router.post('/batch', authenticate, async (req, res) => {
  try {
    const { contracts } = req.body;
    
    if (!contracts || !Array.isArray(contracts) || contracts.length === 0) {
      return res.status(400).json({
        error: { message: 'Invalid or empty contracts array' }
      });
    }

    // Use direct SQL instead of Sequelize model to bypass model validation
    const createdContracts = [];
    
    for (const contract of contracts) {
      try {
        // Only use the essential fields we know exist in the database
        const query = `
          INSERT INTO contracts 
          (name, contenttype, contractValue, renewalDate, userId, createdAt, updatedAt) 
          VALUES 
          (:name, :contentType, :contractValue, :renewalDate, :userId, NOW(), NOW())
          RETURNING id, name, contenttype, contractValue, renewalDate, userId, createdAt, updatedAt
        `;
        
        const result = await sequelize.query(query, {
          replacements: {
            name: contract.name || 'Unnamed Contract',
            contentType: contract.contentType || 'application/pdf', // Default content type
            contractValue: contract.amount ? parseFloat(contract.amount) : null,
            renewalDate: contract.renewalDate ? new Date(contract.renewalDate) : null,
            userId: req.user.id
          },
          type: QueryTypes.INSERT
        });
        
        if (result && result[0] && result[0][0]) {
          createdContracts.push(result[0][0]);
        }
      } catch (contractError) {
        console.error('Error creating individual contract:', contractError);
        // Continue with other contracts even if one fails
      }
    }
    
    if (createdContracts.length === 0) {
      return res.status(500).json({
        error: { message: 'Failed to create any contracts' }
      });
    }
    
    res.status(201).json({
      message: `Successfully created ${createdContracts.length} contracts`,
      contracts: createdContracts
    });
  } catch (error) {
    console.error('Error in batch contract upload:', error);
    res.status(500).json({
      error: { message: 'Failed to create contracts in batch', details: error.message }
    });
  }
});

module.exports = router; 