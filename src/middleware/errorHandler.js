const logger = require('../config/logger');
const config = require('../config');

// Last-resort safety net: an uncaught error in any route must never crash the
// process or leak a stack trace to the gateway. A USSD session that hits this
// still gets a clean end so the user isn't left hanging, in whichever
// protocol shape that route's gateway expects.
module.exports = function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  logger.error('unhandled_error', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    body: req.body,
  });

  if (req.path === '/ussd') {
    return res.type('text/plain').send('END Sorry, something went wrong. Please try again later.');
  }

  if (req.path === '/ussd/comviva') {
    const { responseHeaders, charge } = config.comviva;
    res.set(responseHeaders.freeflow, 'FB');
    res.set(responseHeaders.charge, charge.enabled ? 'Y' : 'N');
    res.set(responseHeaders.amount, String(charge.amount));
    return res.type('text/plain').send('Sorry, something went wrong. Please try again later.');
  }

  res.status(500).json({ error: 'Internal server error' });
};
