'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove hold-related columns and add export-related columns
    await queryInterface.removeColumn('vault_searches', 'gmail_hold_id');
    await queryInterface.removeColumn('vault_searches', 'drive_hold_id');
    await queryInterface.removeColumn('vault_searches', 'export_id');
    
    await queryInterface.addColumn('vault_searches', 'gmail_export_id', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('vault_searches', 'drive_export_id', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
    // Rename keywords column to search_terms if it exists
    try {
      await queryInterface.renameColumn('vault_searches', 'keywords', 'search_terms');
    } catch (error) {
      // If the column was already named search_terms, or doesn't exist, ignore the error
      console.log('Keywords column not found or already renamed');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Revert the changes
    await queryInterface.removeColumn('vault_searches', 'gmail_export_id');
    await queryInterface.removeColumn('vault_searches', 'drive_export_id');
    
    await queryInterface.addColumn('vault_searches', 'gmail_hold_id', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('vault_searches', 'drive_hold_id', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('vault_searches', 'export_id', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
    // Try to revert the column name change
    try {
      await queryInterface.renameColumn('vault_searches', 'search_terms', 'keywords');
    } catch (error) {
      console.log('Cannot revert search_terms column');
    }
  }
}; 