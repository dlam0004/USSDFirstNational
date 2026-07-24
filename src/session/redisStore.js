// Redis-backed session store — required for real/production use so that
// sessions survive server restarts and work across multiple instances
// without any sticky-session dependency.

const Redis = require('ioredis');
const config = require('../config');
const logger = require('../config/logger');

let client;

function getClient() {
  if (!client) {
    client = new Redis(config.redisUrl);
    client.on('error', (err) => logger.error('redis_error', { error: err.message }));
  }
  return client;
}

async function connect() {
  const c = getClient();
  if (c.status === 'ready') return;
  await new Promise((resolve, reject) => {
    c.once('ready', resolve);
    c.once('error', reject);
  });
  logger.info('redis_connected', { url: config.redisUrl.replace(/\/\/.*@/, '//***@') });
}

function key(sessionId) {
  return `ussd:session:${sessionId}`;
}

async function get(sessionId) {
  const raw = await getClient().get(key(sessionId));
  return raw ? JSON.parse(raw) : null;
}

async function set(sessionId, data, ttlSeconds) {
  await getClient().set(key(sessionId), JSON.stringify(data), 'EX', ttlSeconds);
}

async function del(sessionId) {
  await getClient().del(key(sessionId));
}

module.exports = { connect, get, set, del };
