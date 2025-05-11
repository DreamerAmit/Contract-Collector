const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Middleware to authenticate token
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    // Verify token
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by id
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 401;
      throw error;
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      error.statusCode = 401;
      error.message = 'Invalid or expired token';
    }
    next(error);
  }
};

module.exports = { authenticate }; 