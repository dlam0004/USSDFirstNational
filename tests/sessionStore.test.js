process.env.SESSION_STORE = 'memory';
const sessionStore = require('../src/session/sessionStore');

describe('memory session store', () => {
  it('returns null for a session that was never set', async () => {
    expect(await sessionStore.get('unknown-id')).toBeNull();
  });

  it('stores and retrieves a session', async () => {
    await sessionStore.set('abc', { state: 'MAIN' }, 60);
    expect(await sessionStore.get('abc')).toEqual({ state: 'MAIN' });
  });

  it('deletes a session', async () => {
    await sessionStore.set('to-delete', { state: 'MAIN' }, 60);
    await sessionStore.del('to-delete');
    expect(await sessionStore.get('to-delete')).toBeNull();
  });

  it('expires a session after its TTL elapses', async () => {
    await sessionStore.set('short-lived', { state: 'MAIN' }, 0.05); // 50ms
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await sessionStore.get('short-lived')).toBeNull();
  });
});
