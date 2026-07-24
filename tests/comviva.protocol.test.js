process.env.SESSION_STORE = 'memory';
process.env.LOG_LEVEL = 'error';
// Exercise the auth check with (synthetic, non-credential-shaped) test
// values configured, rather than its no-op-when-blank fallback — see
// comvivaController.js. Generated per test run, never a real secret and
// never reused from Comviva's own doc sample, so this can't be mistaken for
// a leaked credential by a secret scanner or a future reader of this file.
process.env.COMVIVA_USER_ID = `test-fixture-${Math.random().toString(36).slice(2)}`;
process.env.COMVIVA_PASSWORD = `test-fixture-${Math.random().toString(36).slice(2)}`;

const request = require('supertest');
const app = require('../src/app');

const MSISDN = '27835550000';
const AUTH = { userid: process.env.COMVIVA_USER_ID, password: process.env.COMVIVA_PASSWORD };

function dial(sessionId, input, msisdn = MSISDN) {
  return request(app)
    .post('/ussd/comviva')
    .query({ MSISDN: msisdn, sessionId, input, ...AUTH });
}

// Every completed flow ends with this Service Reference confirmation.
const SR_RE = /Service Reference \(SR\) number is: (\S+)\./;

describe('Comviva VAS Cloud-Service-Creation adapter', () => {
  it('shows the main menu on first dial, with FC/N/0 headers and cpRefId set', async () => {
    const res = await dial('c1', '');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Merchant Services :-\)$/m);
    expect(res.text).not.toMatch(/^CON|^END/); // no Africa's Talking-style prefix on this route
    expect(res.headers.freeflow).toBe('FC');
    expect(res.headers.charge).toBe('N');
    expect(res.headers.amount).toBe('0');
    expect(res.headers.cprefid).toBe('c1');
  });

  it('completes Log a Query end-to-end, ending with FB and an SR number', async () => {
    await dial('c2', '');
    await dial('c2', '1'); // Log a Query
    await dial('c2', '1'); // Battery Issues
    await dial('c2', '10111'); // Merchant ID
    const res = await dial('c2', '76012345'); // Alternative Contact
    expect(res.headers.freeflow).toBe('FB');
    expect(res.text).toMatch(/^Thank you for contacting us\./);
    expect(res.text).toMatch(SR_RE);
  });

  it('rejects an invalid Merchant ID, lets the user retry, and stays FC', async () => {
    await dial('c3', '');
    await dial('c3', '1'); // Log a Query
    await dial('c3', '1'); // Battery Issues
    const invalid = await dial('c3', 'abc');
    expect(invalid.headers.freeflow).toBe('FC');
    expect(invalid.text).toMatch(/^Enter a valid Merchant ID\./);
  });

  it('supports back (0) and exit (00), with exit reported as FB', async () => {
    await dial('c4', '');
    await dial('c4', '1'); // Log a Query category screen
    const back = await dial('c4', '0');
    expect(back.headers.freeflow).toBe('FC');
    expect(back.text).toMatch(/Merchant Services :-\)$/m);

    const res = await dial('c4', '00');
    expect(res.headers.freeflow).toBe('FB');
    expect(res.text).toMatch(/^Thank you for using/);
  });

  it('recovers to the main menu instead of erroring on an unknown/expired session', async () => {
    // Unlike the Africa's Talking route, Comviva's "input" is only the
    // current step, not cumulative history — so there's nothing to lose by
    // restarting cleanly at the main menu when the session isn't found.
    const res = await dial('never-seen-before', '1');
    expect(res.status).toBe(200);
    expect(res.headers.freeflow).toBe('FC');
    expect(res.text).toMatch(/Merchant Services :-\)$/m);
  });

  it('rejects a request with no MSISDN', async () => {
    const res = await request(app)
      .post('/ussd/comviva')
      .query({ sessionId: 'c5', input: '', ...AUTH });
    expect(res.status).toBe(400);
  });

  it('rejects a request with the wrong credentials', async () => {
    const res = await request(app)
      .post('/ussd/comviva')
      .query({ MSISDN, sessionId: 'c6', input: '', userid: 'wrong', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('deletes the session on a cleanup request', async () => {
    await dial('c7', ''); // MAIN
    await dial('c7', '1'); // now in LOG_QUERY_CATEGORY

    const cleanup = await request(app)
      .post('/ussd/comviva')
      .query({ MSISDN, sessionId: 'c7', clean: 'clean-session', status: '522', ...AUTH });
    expect(cleanup.status).toBe(200);
    expect(cleanup.text).toBe('');

    // If the session had survived, an empty input on LOG_QUERY_CATEGORY
    // would come back "Invalid option." — seeing the main menu instead
    // proves the cleanup request actually deleted it.
    const after = await dial('c7', '');
    expect(after.text).toMatch(/Merchant Services :-\)$/m);
  });

  it('falls back to keying the session on MSISDN when no Session Id is sent, matching the doc\'s cleanup sample', async () => {
    const noSessionId = (input) =>
      request(app).post('/ussd/comviva').query({ MSISDN: '27839990000', input, ...AUTH });

    await noSessionId(''); // MAIN
    await noSessionId('1'); // LOG_QUERY_CATEGORY

    const cleanup = await request(app)
      .post('/ussd/comviva')
      .query({ MSISDN: '27839990000', clean: 'clean-session', status: '522', ...AUTH });
    expect(cleanup.status).toBe(200);

    const after = await noSessionId('');
    expect(after.text).toMatch(/Merchant Services :-\)$/m);
  });
});
