const flows = require('../src/ussd/flows');

// Requirement 4.2: each screen must fit within ~140-182 characters
// (varies by operator). This is a regression guard against menu copy
// creeping past what gateways will actually display.
const MAX_SCREEN_LENGTH = 182;

const sampleSession = {
  phoneNumber: '254700000000',
  data: {
    category: 'Other',
    merchantId: '10111',
    terminalId: '10111',
    speedpointType: 'Replacement',
    details: 'Sample details',
  },
};

describe('menu screen length', () => {
  Object.entries(flows).forEach(([stateName, flow]) => {
    it(`${stateName} render() fits within ${MAX_SCREEN_LENGTH} characters`, () => {
      const text = flow.render(sampleSession);
      expect(typeof text).toBe('string');
      expect(text.length).toBeLessThanOrEqual(MAX_SCREEN_LENGTH);
    });
  });
});
