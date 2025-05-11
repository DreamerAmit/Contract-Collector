const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class VaultSearch extends Model {}

VaultSearch.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  matterId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  gmailExportId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  driveExportId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('CREATED', 'PROCESSING', 'COMPLETED', 'FAILED'),
    defaultValue: 'CREATED'
  },
  searchTerms: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resultCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  processed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  results: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'VaultSearch',
  tableName: 'vault_searches',
  underscored: true
});

module.exports = VaultSearch; 