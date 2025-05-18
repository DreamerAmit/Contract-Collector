const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { Contract } = require('../models');
const { Op } = require('sequelize');

// Get dashboard statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    // Get current date
    const today = new Date();
    
    // Calculate date 30 days from now
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    // Count total contracts
    const contractsCount = await Contract.count({
      where: {
        userId: req.user.id
      }
    });
    
    // Count upcoming renewals (within next 30 days)
    const upcomingRenewals = await Contract.count({
      where: {
        userId: req.user.id,
        renewalDate: {
          [Op.between]: [today, thirtyDaysFromNow]
        }
      }
    });
    
    res.json({
      contractsCount,
      upcomingRenewals
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      error: { message: 'Failed to get dashboard statistics', details: error.message }
    });
  }
});

module.exports = router;
