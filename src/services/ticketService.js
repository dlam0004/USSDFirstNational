// Mocked/stubbed ticketing backend. Out of scope for this phase per project
// requirements — a real CRM/ticketing integration (e.g. Salesforce, Zendesk,
// an internal case-management API) replaces this module later without any
// USSD flow code changing, since it exposes the same function signatures.
//TODO: thisis stand in file not a real integration, no ticket actualy get created
const config = require('../config');
const emailService = require('./emailService');

let sequence = 1000;
const tickets = new Map(); // srNumber -> ticket record

function nextSr() {
  sequence += 1;
  return `${config.companyCode}-MS-${sequence}`;
}

function createTicket(type, fields) {
  const sr = nextSr();
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

module.exports = { logQuery, logComplaint, requestSpeedpoint, listByPhone };
