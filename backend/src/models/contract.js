const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Contract extends Model {}

Contract.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contentType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sourceEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sourceDriveId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  extractedText: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  contractValue: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  renewalDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
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
  modelName: 'Contract',
  tableName: 'contracts'
});

module.exports = Contract; 