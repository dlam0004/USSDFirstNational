
//NOTE:
const config = require('../config');
const logger = require('../config/logger');
const sessionStore = require('../session/sessionStore');
const ticketService = require('../services/ticketService');
const { route } = require('./router');
const STATES = require('./states');

/**
 * Express handler for the USSD gateway webhook (Africa's Talking compatible).
 * Expects application/x-www-form-urlencoded body: sessionId, phoneNumber, text.
 * Always responds with text/plain "CON ..." (more input expected) or
 * "END ..." (session over) — the app never throws past this point.
 */
async function handle(req, res, next) {
  try {
    const { sessionId, phoneNumber, text } = req.body;
    const safeText = typeof text === 'string' ? text : '';

    if (!sessionId || !phoneNumber) {
      logger.warn('malformed_ussd_request', { body: req.body });
      return res.type('text/plain').send('END Invalid request.');
    }

    let session = await sessionStore.get(sessionId);
    let isNew = false;

    if (!session) {
      if (safeText.trim() !== '') {
        // We have no record of this session (expired, evicted, or the
        // server restarted) but the gateway is mid-flow. Never guess at
        // state — end cleanly and tell the user to redial.
        logger.warn('unknown_session_with_input', { sessionId, phoneNumber });
        return res.type('text/plain').send('END Your session has expired. Please dial again.');
      }
      session = { sessionId, phoneNumber, state: STATES.MAIN, data: { backStack: [] } };
      isNew = true;
    }

    const parts = safeText.split('*');
    const lastInput = isNew ? '' : parts[parts.length - 1];
    const previousState = session.state;

    const result = await route(session, lastInput, { isNew, ticketService });

    if (result.end) {
      await sessionStore.del(sessionId);
    } else {
      await sessionStore.set(sessionId, session, config.sessionTtlSeconds);
    }

    const responseBody = `${result.end ? 'END' : 'CON'} ${result.text}`;

    logger.info('ussd_interaction', {
      sessionId,
      phoneNumber,
      input: STATES.SENSITIVE.has(previousState) ? '****' : lastInput,
      previousState,
      nextState: session.state,
      response: responseBody,
      ended: result.end,
    });

    res.type('text/plain').send(responseBody);
  } catch (err) {
    next(err);
  }
}

module.exports = { handle };
