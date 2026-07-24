const logger = require('../config/logger');

// Generic HTTP access log (method/path/status/latency). The detailed,
// PIN-redacted USSD conversation log lives in ussd/controller.js since it
// needs session state to know which fields are sensitive.
module.exports = function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('http_request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
};
