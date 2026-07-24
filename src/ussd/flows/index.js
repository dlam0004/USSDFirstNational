const STATES = require('../states');
const mainMenu = require('./mainMenu');
const logQuery = require('./logQuery');
const logComplaint = require('./logComplaint');
const requestSpeedpoint = require('./requestSpeedpoint');
const trackQuery = require('./trackQuery');

module.exports = {
  [STATES.MAIN]: mainMenu,
  ...logQuery,
  ...logComplaint,
  ...requestSpeedpoint,
  ...trackQuery,
};
