'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('vault_searches', 'service', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('vault_searches', 'data_scope', {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'data_scope'
    });
    
    await queryInterface.addColumn('vault_searches', 'entity_type', {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'entity_type'
    });
    
    await queryInterface.addColumn('vault_searches', 'specific_accounts', {
      type: Sequelize.JSON,
      allowNull: true,
      field: 'specific_accounts'
    });
    
    await queryInterface.addColumn('vault_searches', 'time_zone', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'UTC',
      field: 'time_zone'
    });
    
    await queryInterface.addColumn('vault_searches', 'exclude_drafts', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: true,
      field: 'exclude_drafts'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('vault_searches', 'service');
    await queryInterface.removeColumn('vault_searches', 'data_scope');
    await queryInterface.removeColumn('vault_searches', 'entity_type');
    await queryInterface.removeColumn('vault_searches', 'specific_accounts');
    await queryInterface.removeColumn('vault_searches', 'time_zone');
    await queryInterface.removeColumn('vault_searches', 'exclude_drafts');
  }
};
