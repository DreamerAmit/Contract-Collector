require('dotenv').config();
const { sequelize } = require('../config/database');
const { User, Contract, Keyword, CalendarEvent } = require('../models');

/**
 * Initialize database by creating all tables
 */
async function initializeDatabase() {
  try {
    console.log('Synchronizing database models...');
    
    // Force: true will drop tables if they exist
    // Use with caution in production
    await sequelize.sync({ force: true });
    
    console.log('Database synchronized successfully.');
    
    // Optionally create a test user
    if (process.env.NODE_ENV === 'development') {
      console.log('Creating test user...');
      
      const testUser = await User.create({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      });
      
      console.log(`Test user created with ID: ${testUser.id}`);
    }
    
    console.log('Database initialization completed.');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await sequelize.close();
  }
}

// Run the initialization
initializeDatabase(); 