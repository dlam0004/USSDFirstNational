const flows = require('./flows');
const STATES = require('./states');

const GOODBYE_MESSAGE = 'Thank you for using our service. Goodbye.';

function renderState(session, prefix = '') {
  const flow = flows[session.state];
  return { end: false, text: `${prefix}${flow.render(session)}` };
}

/**
 * Generic USSD menu state machine.
 *
 * Each flow module owns exactly one state and implements:
 *   render(session)              -> screen text for that state
 *   handle(input, session, ctx)  -> { valid, end?, nextState?, message? }
 *
 * "0" (back) and "00" (exit) are handled here once, generically, so no flow
 * has to reimplement navigation. Back-navigation uses a stack of visited
 * states pushed on every forward transition, which naturally supports
 * branching flows (e.g. buy-airtime for self vs. another number).
 */
async function route(session, input, ctx) {
  if (ctx.isNew) {
    session.state = STATES.MAIN;
    session.data = { backStack: [] };
    return renderState(session);
  }

  const trimmed = (input || '').trim();

  if (trimmed === '00') {
    return { end: true, text: GOODBYE_MESSAGE };
  }

  if (trimmed === '0') {
    const stack = session.data.backStack || [];
    if (stack.length === 0) {
      return renderState(session, 'Invalid option.\n');
    }
    session.state = stack.pop();
    return renderState(session);
  }

  const flow = flows[session.state];
  if (!flow) {
    // Corrupted/unknown state — fail safe rather than throw.
    return { end: true, text: 'Sorry, an error occurred. Please dial again.' };
  }

  const result = await flow.handle(trimmed, session, ctx);

  if (!result.valid) {
    return renderState(session, result.message ? `${result.message}\n` : '');
  }

  if (result.end) {
    return { end: true, text: result.message };
  }

  if (result.nextState) {
    session.data.backStack = session.data.backStack || [];
    session.data.backStack.push(session.state);
    session.state = result.nextState;
  }

  return renderState(session, result.message ? `${result.message}\n` : '');
}

module.exports = { route, GOODBYE_MESSAGE };
