const STATES = require('../states');
const { isValidId, isValidContact, sanitizeDetails } = require('./shared');

const detailsState = {
  render() {
    return 'Type your complaint details\n0. Back';
  },
  async handle(input, session) {
    const details = sanitizeDetails(input);
    if (!details) {
      return { valid: false, message: 'Please enter a short description.' };
    }
    session.data.details = details;
    return { valid: true, nextState: STATES.LOG_COMPLAINT_MERCHANT_ID };
  },
};

const merchantIdState = {
  render() {
    return 'Please Enter Merchant ID\n0. Back';
  },
  async handle(input, session) {
    if (!isValidId(input)) {
      return { valid: false, message: 'Enter a valid Merchant ID.' };
    }
    session.data.merchantId = input;
    return { valid: true, nextState: STATES.LOG_COMPLAINT_CONTACT };
  },
};

const contactState = {
  render() {
    return 'Please Enter Alternative Contact #\n0. Back';
  },
  async handle(input, session, ctx) {
    if (!isValidContact(input)) {
      return { valid: false, message: 'Enter a valid contact number.' };
    }
    const sr = await ctx.ticketService.logComplaint({
      phoneNumber: session.phoneNumber,
      details: session.data.details,
      merchantId: session.data.merchantId,
      contact: input,
    });
    return {
      valid: true,
      end: true,
      message: `Thank you for contacting us. Your Service Reference (SR) number is: ${sr}.\n\nA consultant will assist you.`,
    };
  },
};

module.exports = {
  [STATES.LOG_COMPLAINT_DETAILS]: detailsState,
  [STATES.LOG_COMPLAINT_MERCHANT_ID]: merchantIdState,
  [STATES.LOG_COMPLAINT_CONTACT]: contactState,
};
