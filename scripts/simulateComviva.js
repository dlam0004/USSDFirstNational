const readline = require('readline');

// Interactive tester for the Comviva route — the Africa's Talking-shaped
// scripts/simulate.js can't be pointed at this route: it sends a form body
// and reads a CON/END-prefixed reply, neither of which this protocol uses.
// This sends the same query-string-on-a-POST shape the real gateway will,
// and reads the Freeflow/charge/cpRefId response headers back.
const URL = process.env.USSD_COMVIVA_URL || 'http://localhost:3000/ussd/comviva';
const msisdn = process.env.USSD_PHONE || '27831234567';
const sessionId = `sim-comviva-${Date.now()}`;
// Only sent if set — matches the auth check being a no-op until
// COMVIVA_USER_ID/COMVIVA_PASSWORD are configured on the server.
const userId = process.env.COMVIVA_USER_ID || '';
const password = process.env.COMVIVA_PASSWORD || '';

let input = '';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function send() {
  const params = new URLSearchParams({ MSISDN: msisdn, sessionId, input });
  if (userId) params.set('userid', userId);
  if (password) params.set('password', password);

  const res = await fetch(`${URL}?${params}`, { method: 'POST' });

  if (res.status !== 200) {
    console.log(`\n--- request failed: HTTP ${res.status} ---\n`);
    return true;
  }

  const text = await res.text();
  const ended = res.headers.get('Freeflow') === 'FB';
  console.log(`\n${text}\n`);
  return ended;
}

async function prompt() {
  const ended = await send();
  if (ended) {
    console.log('--- session ended ---');
    rl.close();
    return;
  }
  rl.question('> ', (answer) => {
    input = answer;
    prompt();
  });
}

console.log(`Dialing USSD via Comviva protocol... (session ${sessionId}, MSISDN ${msisdn})`);
prompt().catch((err) => {
  console.error('Simulator error:', err.message);
  console.error('Is the server running? Try `npm run dev` in another terminal first.');
  rl.close();
});
