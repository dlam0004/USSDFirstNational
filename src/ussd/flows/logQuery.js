const STATES = require('../states');
const { isValidId, isValidContact, sanitizeDetails } = require('./shared');

const QUERY_CATEGORIES = {
  1: 'Battery Issues',
  2: 'Banking Issues',
  4: 'Speedpoint Rolls',
  5: 'Training',
  6: 'Other',
};

const categoryState = {
  render() {
    return (
      'Log a Query\n1. Battery Issues\n2. Banking Issues\n3. Device Faulty\n' +
      '4. Speedpoint Rolls\n5. Training\n6. Other\n0. Back'
    );
  },
  async handle(input, session) {
    if (input === '3') {
      return { valid: true, nextState: STATES.DEVICE_FAULTY_CATEGORY };
    }
    const category = QUERY_CATEGORIES[input];
    if (!category) {
      return { valid: false, message: 'Invalid option.' };
    }
    session.data.category = category;
    return { valid: true, nextState: STATES.LOG_QUERY_MERCHANT_ID };
  },
};

const deviceFaultyState = {
  render() {
    return 'Device Faulty\n1. Printer\n2. Connection\n0. Back';
  },
  async handle(input, session) {
    if (input === '1') {
      session.data.category = 'Device Faulty - Printer';
    } else if (input === '2') {
      session.data.category = 'Device Faulty - Connection';
    } else {
      return { valid: false, message: 'Invalid option.' };
    }
    return { valid: true, nextState: STATES.LOG_QUERY_MERCHANT_ID };
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
    const nextState =
      session.data.category === 'Other' ? STATES.LOG_QUERY_OTHER_DETAILS : STATES.LOG_QUERY_CONTACT;
    return { valid: true, nextState };
  },
};

const otherDetailsState = {
  render() {
    return 'Type your query details\n0. Back';
  },
  async handle(input, session) {
    const details = sanitizeDetails(input);
    if (!details) {
      return { valid: false, message: 'Please enter a short description.' };
    }
    session.data.details = details;
    return { valid: true, nextState: STATES.LOG_QUERY_CONTACT };
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
    // Ticket is only created here, on the final confirmed step — a session
    // dying at any earlier step leaves zero side effects.
    const sr = await ctx.ticketService.logQuery({
      phoneNumber: session.phoneNumber,
      category: session.data.category,
      merchantId: session.data.merchantId,
      details: session.data.details,
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
  [STATES.LOG_QUERY_CATEGORY]: categoryState,
  [STATES.DEVICE_FAULTY_CATEGORY]: deviceFaultyState,
  [STATES.LOG_QUERY_MERCHANT_ID]: merchantIdState,
  [STATES.LOG_QUERY_OTHER_DETAILS]: otherDetailsState,
  [STATES.LOG_QUERY_CONTACT]: contactState,
};
