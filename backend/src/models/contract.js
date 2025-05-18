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
  filepath: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contenttype: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sourceemail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sourcedriveid: {
    type: DataTypes.STRING,
    allowNull: true
  },
  extractedtext: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  contractvalue: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  renewaldate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  userid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  createdat: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedat: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'Contract',
  tableName: 'contracts',
  underscored: true,
  timestamps: false
});

module.exports = Contract; 