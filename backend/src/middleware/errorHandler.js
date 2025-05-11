// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Default error message and status
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors = null;

  // Handle different types of errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    message = 'Validation Error';
    errors = err.errors.map(e => ({
      field: e.path,
      message: e.message
    }));
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (err.statusCode) {
    // If the error already has a status code
    statusCode = err.statusCode;
    message = err.message;
  }

  res.status(statusCode).json({
    error: {
      message,
      ...(errors && { errors }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

module.exports = errorHandler; 