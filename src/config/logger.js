const fs = require('fs');
const path = require('path');
const winston = require('winston');
const config = require('./index');

if (!fs.existsSync(config.logDir)) {
  fs.mkdirSync(config.logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ussd-app', env: config.env },
  transports: [
    new winston.transports.Console({
      format:
        config.env === 'development'
          ? winston.format.combine(winston.format.colorize(), winston.format.simple())
          : winston.format.json(),
    }),
    new winston.transports.File({ filename: path.join(config.logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(config.logDir, 'combined.log') }),
  ],
  exitOnError: false,
});

module.exports = logger;
