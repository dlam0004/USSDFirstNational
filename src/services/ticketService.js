// Mocked/stubbed ticketing backend. Out of scope for this phase per project
// requirements — a real CRM/ticketing integration (e.g. Salesforce, Zendesk,
// an internal case-management API) replaces this module later without any
// USSD flow code changing, since it exposes the same function signatures.
// Ticket *records* (used by Track Query) are still an in-memory Map and
// still don't survive a restart — that's the same known mock-backend gap
// documented in PROGRESS.md/README, unchanged by this fix.
//
// SR *numbers* are a narrower problem that's fixed here: they used to come
// from a plain in-memory counter, so every process restart reset it back to
// 1000, producing duplicate SR numbers across restarts (e.g. FNB-MS-1001
// every time). That's now a Redis-backed atomic INCR — unique and
// restart-proof — with a graceful fallback to the old in-memory counter if
// Redis is ever unreachable, so ticket creation itself never breaks.
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../config/logger');
const emailService = require('./emailService');

const SR_KEY = 'ussd:ticket:sequence';
const SR_BASE = 1000;

const tickets = new Map(); // srNumber -> ticket record

let redisClient;
let redisReady = false;
let fallbackSequence = SR_BASE;

// Call once at server startup (see server.js). Never throws — Redis being
// down must not stop the app from starting or from creating tickets, it
// just means SR numbers fall back to the old reset-on-restart behaviour.
async function connect() {
  if (config.env === 'test') return; // tests never touch a real Redis
  const c = new Redis(config.redisUrl);
  c.on('error', (err) => {
    if (redisReady) logger.error('ticket_sequence_redis_error', { error: err.message });
  });
  try {
    await new Promise((resolve, reject) => {
      c.once('ready', resolve);
      c.once('error', reject);
    });
    redisClient = c;
    redisReady = true;
    logger.info('ticket_sequence_redis_connected', {
      url: config.redisUrl.replace(/\/\/.*@/, '//***@'),
    });
  } catch (err) {
    logger.warn('ticket_sequence_redis_unavailable', {
      error: err.message,
      message: 'SR numbers will fall back to an in-memory counter that resets on restart.',
    });
    c.disconnect(); // stop ioredis retrying against a host that isn't there
  }
}

// Atomic across concurrent requests (and across every server instance, once
// there's more than one) via Redis INCR when available. Falls back to the
// old in-memory counter only if Redis was never reachable, or a single
// INCR call fails — ticket creation must never be blocked by this.
async function nextSr() {
  if (redisReady) {
    try {
      const n = await redisClient.incr(SR_KEY);
      return `${config.companyCode}-MS-${SR_BASE + n}`;
    } catch (err) {
      logger.error('ticket_sequence_redis_incr_failed', { error: err.message });
    }
  }
  fallbackSequence += 1;
  return `${config.companyCode}-MS-${fallbackSequence}`;
}

async function createTicket(type, fields) {
  const sr = await nextSr();
  const ticket = {
    sr,
    type,
    status: 'IN-PROGRESS',
    createdAt: new Date().toISOString(),
    ...fields,
  };
  tickets.set(sr, ticket);
  // Fire-and-forget: the ticket is already saved above, so a slow/failed
  // support-team email must never delay or fail the USSD response itself.
  emailService.notifyTicketCreated(ticket);
  return sr;
}


async function logQuery(fields) {
  return createTicket('query', fields);
}

async function logComplaint(fields) {
  return createTicket('complaint', fields);
}

async function requestSpeedpoint(fields) {
  return createTicket('speedpoint', fields);
}

const MAX_RECENT = 5;

// Newest first — Map preserves insertion order, so reversing gives a stack
// (last created is first shown), then cap to the most recent few.
function listByPhone(phoneNumber, limit = MAX_RECENT) {
  const results = [];
  for (const ticket of tickets.values()) {
    if (ticket.phoneNumber === phoneNumber) results.push(ticket);
  }
  return results.reverse().slice(0, limit);
}

module.exports = { connect, logQuery, logComplaint, requestSpeedpoint, listByPhone };
