const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class CalendarEvent extends Model {}

CalendarEvent.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  googleEventId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contractId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'contracts',
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
  modelName: 'CalendarEvent',
  tableName: 'calendar_events'
});

module.exports = CalendarEvent; 