const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        error: { message: 'User with this email already exists' }
      });
    }

    // Create new user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName
    });

    // Generate JWT token
    const token = jwt.sign(
      user.generateTokenPayload(),
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );

    // Return user data and token (excluding password)
    res.status(201).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      googleConnected: false,
      googleWorkspaceEmail: null,
      token
    });
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to register user', details: error.message }
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        error: { message: 'Invalid credentials' }
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: { message: 'Invalid credentials' }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      user.generateTokenPayload(),
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );

    // Return user data and token
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      googleConnected: !!user.googleRefreshToken,
      googleWorkspaceEmail: user.googleWorkspaceEmail || null,
      token
    });
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to login', details: error.message }
    });
  }
});

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    // Return user data (excluding password)
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      googleConnected: !!user.googleRefreshToken,
      googleWorkspaceEmail: user.googleWorkspaceEmail || null
    });
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to get user profile', details: error.message }
    });
  }
});

// Update user profile
router.put('/me', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { firstName, lastName, password } = req.body;

    // Update fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (password !== undefined) user.password = password;

    await user.save();
    
    // Return updated user data
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    });
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to update profile', details: error.message }
    });
  }
});

module.exports = router; 