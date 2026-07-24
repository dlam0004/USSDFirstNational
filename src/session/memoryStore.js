// In-memory session store. Suitable for local dev/demo only:
// state is lost on restart and is NOT shared across multiple instances.
// Production/staging must use SESSION_STORE=redis (see redisStore.js).

const sessions = new Map();

async function connect() {
  // no-op, kept for interface parity with redisStore
}

async function get(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  return entry.data;
}

async function set(sessionId, data, ttlSeconds) {
  sessions.set(sessionId, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function del(sessionId) {
  sessions.delete(sessionId);
}

module.exports = { connect, get, set, del };
