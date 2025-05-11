const { sequelize } = require('../config/database');
const User = require('./user');
const Contract = require('./contract');
const Keyword = require('./keyword');
const CalendarEvent = require('./calendarEvent');
const VaultSearch = require('./vaultSearch');

// Set up associations
User.hasMany(Contract, { foreignKey: 'userId', as: 'contracts' });
Contract.belongsTo(User, { foreignKey: 'userId' });

Contract.hasMany(CalendarEvent, { foreignKey: 'contractId', as: 'calendarEvents' });
CalendarEvent.belongsTo(Contract, { foreignKey: 'contractId' });

User.hasMany(Keyword, { foreignKey: 'userId', as: 'keywords' });
Keyword.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(VaultSearch, { foreignKey: 'userId', as: 'vaultSearches' });
VaultSearch.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  User,
  Contract,
  Keyword,
  CalendarEvent,
  VaultSearch
}; 