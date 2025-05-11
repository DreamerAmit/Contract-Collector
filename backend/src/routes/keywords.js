const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { Keyword } = require('../models');

// Get all keywords for the current user
router.get('/', authenticate, async (req, res) => {
  try {
    const keywords = await Keyword.findAll({
      where: { userId: req.user.id },
      order: [['text', 'ASC']]
    });
    
    res.json(keywords);
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to get keywords', details: error.message }
    });
  }
});

// Create a new keyword
router.post('/', authenticate, async (req, res) => {
  try {
    const { text, category } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: { message: 'Keyword text is required' }
      });
    }
    
    // Check if keyword already exists for this user
    const existingKeyword = await Keyword.findOne({
      where: { 
        text,
        userId: req.user.id
      }
    });
    
    if (existingKeyword) {
      return res.status(400).json({
        error: { message: 'Keyword already exists' }
      });
    }
    
    const keyword = await Keyword.create({
      text,
      category,
      userId: req.user.id
    });
    
    res.status(201).json(keyword);
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to create keyword', details: error.message }
    });
  }
});

// Delete a keyword
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const keyword = await Keyword.findOne({
      where: {
        id,
        userId: req.user.id
      }
    });
    
    if (!keyword) {
      return res.status(404).json({
        error: { message: 'Keyword not found' }
      });
    }
    
    await keyword.destroy();
    
    res.json({ message: 'Keyword deleted successfully' });
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to delete keyword', details: error.message }
    });
  }
});

// Update a keyword
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, category } = req.body;
    
    const keyword = await Keyword.findOne({
      where: {
        id,
        userId: req.user.id
      }
    });
    
    if (!keyword) {
      return res.status(404).json({
        error: { message: 'Keyword not found' }
      });
    }
    
    if (text) keyword.text = text;
    if (category !== undefined) keyword.category = category;
    
    await keyword.save();
    
    res.json(keyword);
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to update keyword', details: error.message }
    });
  }
});

module.exports = router; 