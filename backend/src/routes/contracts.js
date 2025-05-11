const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { Contract } = require('../models');
const { extractTextFromDocument } = require('../utils/documentProcessor');

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
    
    const contracts = await Contract.findAll({
      where: { userId: req.user.id },
      order: [['renewalDate', 'DESC']],
      offset,
      limit
    });
    
    res.json(contracts);
  } catch (error) {
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
    
    // Delete file
    try {
      if (contract.filePath && fs.existsSync(contract.filePath)) {
        fs.unlinkSync(contract.filePath);
      }
    } catch (fileError) {
      console.error('Error deleting file:', fileError);
      // Continue with deletion even if file deletion fails
    }
    
    // Delete from database
    await contract.destroy();
    
    res.json({ message: 'Contract deleted successfully' });
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to delete contract', details: error.message }
    });
  }
});

module.exports = router; 