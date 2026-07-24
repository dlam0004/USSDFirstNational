// Storage-agnostic facade used by the rest of the app. Which backend is used
// is decided once at load time from config, so callers never branch on it.

const config = require('../config');

const store = config.sessionStoreType === 'redis' ? require('./redisStore') : require('./memoryStore');

module.exports = {
  connect: () => store.connect(),
  get: (sessionId) => store.get(sessionId),
  set: (sessionId, data, ttlSeconds) => store.set(sessionId, data, ttlSeconds),
  del: (sessionId) => store.del(sessionId),
};
