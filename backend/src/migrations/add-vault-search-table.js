'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('vault_searches', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        field: 'user_id'
      },
      matterId: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'matter_id'
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true
      },
      gmailHoldId: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'gmail_hold_id'
      },
      driveHoldId: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'drive_hold_id'
      },
      exportId: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'export_id'
      },
      status: {
        type: Sequelize.ENUM('CREATED', 'PROCESSING', 'COMPLETED', 'FAILED'),
        defaultValue: 'CREATED'
      },
      keywords: {
        type: Sequelize.JSON,
        allowNull: true
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'start_date'
      },
      endDate: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'end_date'
      },
      resultCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        field: 'result_count'
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at'
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'updated_at'
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('vault_searches');
  }
}; 