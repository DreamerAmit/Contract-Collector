const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { OpenAI } = require('openai');
const { checkOpenAIConfig, analyzeDocument } = require('../utils/openai');

// Get the openai instance from the utils instead of creating a new one
const { openai } = require('../utils/openai');

// Analyze contract text
router.post('/analyze-contract', authenticate, async (req, res) => {
  try {
    const { contractId, text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: { message: 'Contract text is required for analysis' }
      });
    }
    
    // Simple prompt for contract analysis
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a contract analysis assistant. Extract key information from the contract text provided."
        },
        {
          role: "user",
          content: `Please analyze this contract and extract key information like contract value, renewal date, key terms, and obligations. Here's the contract text: ${text.substring(0, 8000)}` // Limit text length
        }
      ],
      temperature: 0,
      max_tokens: 1000
    });
    
    // Parse the AI response
    const analysis = response.choices[0].message.content;
    
    res.json({
      contractId,
      analysis
    });
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to analyze contract', details: error.message }
    });
  }
});

// Extract keywords from contract
router.post('/extract-keywords', authenticate, async (req, res) => {
  try {
    const { contractId, text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: { message: 'Contract text is required for keyword extraction' }
      });
    }
    
    // Simple prompt for keyword extraction
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a contract keyword extraction assistant. Extract important keywords and phrases from contract text."
        },
        {
          role: "user",
          content: `Please extract the most important keywords and phrases from this contract text: ${text.substring(0, 8000)}` // Limit text length
        }
      ],
      temperature: 0,
      max_tokens: 500
    });
    
    // Parse the AI response
    const keywords = response.choices[0].message.content;
    
    res.json({
      contractId,
      keywords
    });
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to extract keywords', details: error.message }
    });
  }
});

// Check OpenAI configuration
router.get('/check', authenticate, async (req, res) => {
  try {
    const isConfigured = await checkOpenAIConfig();
    
    if (isConfigured) {
      res.json({
        status: 'ok',
        message: 'OpenAI API is properly configured'
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'OpenAI API is not properly configured'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: { 
        message: 'Failed to check OpenAI configuration', 
        details: error.message
      }
    });
  }
});

// Test document analysis
router.post('/test-analysis', authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: { message: 'Text is required for analysis test' }
      });
    }
    
    const analysis = await analyzeDocument(text);
    
    res.json({
      status: 'ok',
      analysis,
      textLength: text.length
    });
  } catch (error) {
    res.status(500).json({
      error: { 
        message: 'Failed to test document analysis', 
        details: error.message
      }
    });
  }
});

module.exports = router; 