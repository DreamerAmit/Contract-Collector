const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth');
const contractsRoutes = require('./contracts');
const keywordsRoutes = require('./keywords');
const calendarRoutes = require('./calendar');
const googleRoutes = require('./google');
const gmailRoutes = require('./gmail');
const aiRoutes = require('./ai');

// Register routes
router.use('/auth', authRoutes);
router.use('/contracts', contractsRoutes);
router.use('/keywords', keywordsRoutes);
router.use('/calendar', calendarRoutes);
router.use('/google', googleRoutes);
router.use('/gmail', gmailRoutes);
router.use('/ai', aiRoutes);

module.exports = router; 