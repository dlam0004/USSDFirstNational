const STATES = require('../states');
const { isValidId, isValidContact } = require('./shared');

const SPEEDPOINT_TYPES = {
  1: 'New Speedpoint',
  2: 'Additional Speedpoint',
};

const categoryState = {
  render() {
    return (
      'Request Speedpoint\n1. New Speedpoint\n2. Additional Speedpoint\n' +
      '3. Replacement\n0. Back'
    );
  },
  async handle(input, session) {
    if (input === '3') {
      session.data.speedpointType = 'Replacement';
      return { valid: true, nextState: STATES.SPEEDPOINT_TERMINAL_ID };
    }
    const type = SPEEDPOINT_TYPES[input];
    if (!type) {
      return { valid: false, message: 'Invalid option.' };
    }
    session.data.speedpointType = type;
    return { valid: true, nextState: STATES.SPEEDPOINT_MERCHANT_ID };
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
    return { valid: true, nextState: STATES.SPEEDPOINT_CONTACT };
  },
};

const terminalIdState = {
  render() {
    return 'Please Enter Terminal ID\n0. Back';
  },
  async handle(input, session) {
    if (!isValidId(input)) {
      return { valid: false, message: 'Enter a valid Terminal ID.' };
    }
    session.data.terminalId = input;
    return { valid: true, nextState: STATES.SPEEDPOINT_CONTACT };
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
    const sr = await ctx.ticketService.requestSpeedpoint({
      phoneNumber: session.phoneNumber,
      speedpointType: session.data.speedpointType,
      merchantId: session.data.merchantId,
      terminalId: session.data.terminalId,
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
  [STATES.SPEEDPOINT_CATEGORY]: categoryState,
  [STATES.SPEEDPOINT_MERCHANT_ID]: merchantIdState,
  [STATES.SPEEDPOINT_TERMINAL_ID]: terminalIdState,
  [STATES.SPEEDPOINT_CONTACT]: contactState,
};
