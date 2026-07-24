const app = require('./src/app');
const config = require('./src/config');
const logger = require('./src/config/logger');
const sessionStore = require('./src/session/sessionStore');

async function start() {
  try {
    await sessionStore.connect();
    app.listen(config.port, () => {
      logger.info('server_started', {
        port: config.port,
        env: config.env,
        sessionStore: config.sessionStoreType,
      });
    });
  } catch (err) {
    logger.error('server_start_failed', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', {
    reason: reason && reason.message,
    stack: reason && reason.stack,
  });
});

start();
