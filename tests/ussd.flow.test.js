process.env.SESSION_STORE = 'memory';
process.env.LOG_LEVEL = 'error';

const request = require('supertest');
const app = require('../src/app');

const PHONE = '25476000000';

function dial(sessionId, text, phoneNumber = PHONE) {
  return request(app)
    .post('/ussd')
    .type('form')
    .send({ sessionId, serviceCode: '*1140#', phoneNumber, text });
}

// Every completed flow ends with this Service Reference confirmation —
// capture the SR number so Track Query tests can look it up.
const SR_RE = /Service Reference \(SR\) number is: (\S+)\./;

describe('USSD full flows', () => {
  it('shows the main menu on first dial', async () => {
    const res = await dial('s1', '');
    expect(res.text).toMatch(/Merchant Services :-\)$/m);
    expect(res.text).toContain('1. Log a Query');
    expect(res.text).toContain('4. Track Query');
  });

  it('completes Log a Query for a direct category (Battery Issues)', async () => {
    await dial('s2', '');
    await dial('s2', '1'); // Log a Query
    await dial('s2', '1*1'); // Battery Issues
    await dial('s2', '1*1*10111'); // Merchant ID
    const res = await dial('s2', '1*1*10111*76012345'); // Alternative Contact
    expect(res.text).toMatch(/^END Thank you for contacting us\./);
    expect(res.text).toMatch(SR_RE);
  });

  it('completes Log a Query via the Device Faulty sub-menu', async () => {
    await dial('s3', '');
    await dial('s3', '1'); // Log a Query
    await dial('s3', '1*3'); // Device Faulty
    await dial('s3', '1*3*2'); // Connection
    await dial('s3', '1*3*2*10111'); // Merchant ID
    const res = await dial('s3', '1*3*2*10111*76012345'); // Alternative Contact
    expect(res.text).toMatch(/^END Thank you for contacting us\./);
  });

  it('completes Log a Query via Other, collecting free-text details', async () => {
    await dial('s4', '');
    await dial('s4', '1'); // Log a Query
    await dial('s4', '1*6'); // Other
    await dial('s4', '1*6*10111'); // Merchant ID
    await dial('s4', '1*6*10111*Call me back urgently'); // query details
    const res = await dial('s4', '1*6*10111*Call me back urgently*76012345'); // contact
    expect(res.text).toMatch(/^END Thank you for contacting us\./);
  });

  it('rejects an invalid Merchant ID and lets the user retry', async () => {
    await dial('s5', '');
    await dial('s5', '1');
    await dial('s5', '1*1');
    const invalid = await dial('s5', '1*1*abc');
    expect(invalid.text).toMatch(/^CON Enter a valid Merchant ID\./);
    await dial('s5', '1*1*abc*10111');
    const res = await dial('s5', '1*1*abc*10111*76012345');
    expect(res.text).toMatch(/^END Thank you for contacting us\./);
  });

  it('completes the Log Complaint flow', async () => {
    await dial('s6', '');
    await dial('s6', '2'); // Log Complaint
    await dial('s6', '2*We are not getting support on time');
    await dial('s6', '2*We are not getting support on time*10111');
    const res = await dial('s6', '2*We are not getting support on time*10111*76012345');
    expect(res.text).toMatch(/^END Thank you for contacting us\./);
  });

  it('completes Request Speedpoint for a New Speedpoint (Merchant ID)', async () => {
    await dial('s7', '');
    await dial('s7', '3'); // Request Speedpoint
    await dial('s7', '3*1'); // New Speedpoint
    await dial('s7', '3*1*10111'); // Merchant ID
    const res = await dial('s7', '3*1*10111*76012345');
    expect(res.text).toMatch(/^END Thank you for contacting us\./);
  });

  it('completes Request Speedpoint for a Replacement (Terminal ID)', async () => {
    await dial('s8', '');
    await dial('s8', '3'); // Request Speedpoint
    await dial('s8', '3*3'); // Replacement
    await dial('s8', '3*3*10111'); // Terminal ID
    const res = await dial('s8', '3*3*10111*76012345');
    expect(res.text).toMatch(/^END Thank you for contacting us\./);
  });

  it('tracks a query by selecting it from the list', async () => {
    await dial('s9', '');
    await dial('s9', '1');
    await dial('s9', '1*2'); // Banking Issues
    await dial('s9', '1*2*10111');
    const created = await dial('s9', '1*2*10111*76012345');
    expect(created.text).toMatch(SR_RE);

    await dial('s10', '');
    const menu = await dial('s10', '4'); // Track Query -> list of recent queries, newest first
    expect(menu.text).toContain('Banking Issues');
    const tracked = await dial('s10', '4*1'); // the query just created is listed first
    expect(tracked.text).toMatch(/^END Your query has been assigned to a consultant and has an IN-PROGRESS status\./);
  });

  it('rejects an out-of-range selection and lets the user retry', async () => {
    await dial('s11', '');
    await dial('s11', '4'); // Track Query
    const invalid = await dial('s11', '4*999');
    expect(invalid.text).toMatch(/^CON Invalid option\./);
  });

  it('shows a friendly message when there are no queries for this number', async () => {
    await dial('s14', '', '25479999999');
    const menu = await dial('s14', '4', '25479999999');
    expect(menu.text).toMatch(/^CON You have no recent queries\./);
  });

  it('supports going back with 0', async () => {
    await dial('s12', '');
    await dial('s12', '1'); // Log a Query -> category screen
    const back = await dial('s12', '1*0'); // back to main menu
    expect(back.text).toMatch(/Merchant Services :-\)$/m);
  });

  it('exits immediately with 00', async () => {
    await dial('s13', '');
    const res = await dial('s13', '1*00');
    expect(res.text).toMatch(/^END Thank you for using/);
  });

  it('ends gracefully instead of crashing on an unknown/expired sessionId', async () => {
    const res = await dial('never-seen-before', '1*1');
    expect(res.text).toBe('END Your session has expired. Please dial again.');
  });

  it('returns a clean END on malformed payloads instead of erroring', async () => {
    const res = await request(app).post('/ussd').type('form').send({ text: '1' });
    expect(res.status).toBe(200);
    expect(res.text).toBe('END Invalid request.');
  });

  it('exposes a health check endpoint', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
