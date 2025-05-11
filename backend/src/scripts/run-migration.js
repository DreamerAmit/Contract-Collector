require('dotenv').config();
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

async function runMigration() {
  try {
    console.log('Running migration to add googleWorkspaceEmail column...');
    
    // Get QueryInterface from sequelize
    const queryInterface = sequelize.getQueryInterface();
    
    try {
      // Check if column already exists
      await sequelize.query(
        'SELECT googleWorkspaceEmail FROM users LIMIT 1'
      );
      console.log('Column googleWorkspaceEmail already exists.');
    } catch (error) {
      // Column doesn't exist, add it
      console.log('Adding googleWorkspaceEmail column to users table...');
      await queryInterface.addColumn('users', 'googleWorkspaceEmail', {
        type: DataTypes.STRING,
        allowNull: true
      });
      console.log('Column added successfully.');
    }
    
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration(); 