const STATES = require('../states');

// Query tickets have a category (e.g. "Battery Issues"); complaint/speedpoint
// tickets don't, so fall back to a type-based label for the menu line.
function ticketLabel(ticket) {
  if (ticket.category) return ticket.category;
  if (ticket.speedpointType) return ticket.speedpointType;
  if (ticket.type === 'complaint') return 'Complaint';
  return ticket.type;
}

const trackListState = {
  render(session) {
    const list = session.data.trackList || [];
    if (list.length === 0) {
      return 'You have no recent queries.\n0. Back';
    }
    const lines = list.map((ticket, i) => `${i + 1}. ${ticketLabel(ticket)} (${ticket.sr}) - ${ticket.status}`);
    return `Select a query to track\n${lines.join('\n')}\n0. Back`;
  },
  async handle(input, session) {
    const list = session.data.trackList || [];
    const index = Number(input);
    if (!Number.isInteger(index) || index < 1 || index > list.length) {
      return { valid: false, message: 'Invalid option.' };
    }
    const ticket = list[index - 1];
    return {
      valid: true,
      end: true,
      message: `Your query has been assigned to a consultant and has an ${ticket.status} status.\n\nThank you for contacting us.`,
    };
  },
};

module.exports = {
  [STATES.TRACK_QUERY_LIST]: trackListState,
};
