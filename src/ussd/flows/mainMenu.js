const STATES = require('../states');
const config = require('../../config');

module.exports = {
  render() {
    return `${config.appName} Merchant Services :-)\n1. Log a Query\n2. Log Complaint\n3. Request Speedpoint\n4. Track Query`;
  },

  async handle(input, session, ctx) {
    switch (input) {
      case '1':
        return { valid: true, nextState: STATES.LOG_QUERY_CATEGORY };
      case '2':
        return { valid: true, nextState: STATES.LOG_COMPLAINT_DETAILS };
      case '3':
        return { valid: true, nextState: STATES.SPEEDPOINT_CATEGORY };
      case '4':
        session.data.trackList = await ctx.ticketService.listByPhone(session.phoneNumber);
        return { valid: true, nextState: STATES.TRACK_QUERY_LIST };
      default:
        return { valid: false, message: 'Invalid option. Please try again.' };
    }
  },
};
