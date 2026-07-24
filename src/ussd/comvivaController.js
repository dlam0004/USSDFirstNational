// Adapter for the Mahindra Comviva VAS Cloud-Service-Creation HTTP(S) Pull

// Two judgment calls made where the doc's generic template doesn't pin down
// our specific node's behaviour (flagged here so they're easy to revisit):
//   - Session key: the doc's own sample requests never show a concrete
//     Session Id value, and the Cleanup Request sample keys on MSISDN alone.
//     So sessions are keyed on the Session Id tag if present, falling back
//     to MSISDN — matching what the cleanup request can actually address.
//   - "New Request" flag: rather than trust its (undocumented) value
//     encoding, "is this session new" is inferred the same way
//     controller.js does — whether we already have a stored session for
//     that key — which is correct regardless of what the flag contains.
//## comviva controller: dial in - menu -> next step -> cleanup -> malformed request -> auth (reject/accept)
const config = require('../config');
const logger = require('../config/logger');
const sessionStore = require('../session/sessionStore');
const ticketService = require('../services/ticketService');
const { route } = require('./router');
const STATES = require('./states');

const { tags, auth, cleanMessage, responseHeaders, charge } = config.comviva;

function authenticated(query) {
  // No credentials configured yet (node not provisioned) — allow through so
  // the adapter is testable before Comviva hands over real ones. Once
  // COMVIVA_USER_ID/COMVIVA_PASSWORD are set, every request must match.
  if (!auth.userId && !auth.password) return true;
  return query[tags.userId] === auth.userId && query[tags.password] === auth.password;
}

/**
 * Express handler for the Comviva VAS Cloud-Service-Creation webhook.
 * Expects request parameters as a query string (even though the gateway
 * calls this with POST) and always responds with the message in the HTTP
 * body plus Freeflow/charge/amount/cpRefId in the response headers.
 */
async function handle(req, res, next) {
  try {
    const query = req.query;

    if (!authenticated(query)) {
      logger.warn('comviva_auth_failed', { userId: query[tags.userId] });
      return res.status(401).end();
    }

    const msisdn = query[tags.msisdn];
    if (!msisdn) {
      logger.warn('comviva_malformed_request', { query });
      return res.status(400).end();
    }

    const sessionKey = query[tags.sessionId] || msisdn;

    if (query[tags.clean] === cleanMessage) {
      await sessionStore.del(sessionKey);
      logger.info('comviva_cleanup', { sessionKey, msisdn, status: query[tags.status] });
      return res.status(200).end();
    }

    let session = await sessionStore.get(sessionKey);
    let isNew = false;

    if (!session) {
      session = { sessionId: sessionKey, phoneNumber: msisdn, state: STATES.MAIN, data: { backStack: [] } };
      isNew = true;
    }

    const input = typeof query[tags.input] === 'string' ? query[tags.input] : '';
    const previousState = session.state;

    const result = await route(session, input, { isNew, ticketService });

    if (result.end) {
      await sessionStore.del(sessionKey);
    } else {
      await sessionStore.set(sessionKey, session, config.sessionTtlSeconds);
    }

    logger.info('ussd_interaction', {
      protocol: 'comviva',
      sessionId: sessionKey,
      phoneNumber: msisdn,
      input: STATES.SENSITIVE.has(previousState) ? '****' : input,
      previousState,
      nextState: session.state,
      response: result.text,
      ended: result.end,
      // Captured for traceability only — see the comment on tags.uniqueId
      // in src/config/index.js for why nothing acts on these values yet.
      uniqueId: query[tags.uniqueId],
      multiAccessCode: query[tags.multiAccessCode],
    });

    res.set(responseHeaders.freeflow, result.end ? 'FB' : 'FC');
    res.set(responseHeaders.charge, charge.enabled ? 'Y' : 'N');
    res.set(responseHeaders.amount, String(charge.amount));
    res.set(responseHeaders.cpRefId, sessionKey);
    res.type('text/plain').send(result.text);
  } catch (err) {
    next(err);
  }
}

module.exports = { handle };
