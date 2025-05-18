const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

// Get dashboard statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    // Use direct SQL queries to avoid Sequelize model case sensitivity issues
    
    // Count total contracts
    const contractsQuery = `
      SELECT COUNT(*) as count
      FROM contracts
      WHERE userid = :userId
    `;
    
    const contractsResult = await sequelize.query(contractsQuery, {
      replacements: { userId: req.user.id },
      type: QueryTypes.SELECT
    });
    
    // Count upcoming renewals (within next 30 days)
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const renewalsQuery = `
      SELECT COUNT(*) as count
      FROM contracts
      WHERE userid = :userId
      AND renewaldate BETWEEN :today AND :future
    `;
    
    const renewalsResult = await sequelize.query(renewalsQuery, {
      replacements: { 
        userId: req.user.id,
        today: today,
        future: thirtyDaysFromNow
      },
      type: QueryTypes.SELECT
    });
    
    res.json({
      contractsCount: parseInt(contractsResult[0].count || '0'),
      upcomingRenewals: parseInt(renewalsResult[0].count || '0')
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      error: { message: 'Failed to get dashboard statistics', details: error.message }
    });
  }
});

module.exports = router;
