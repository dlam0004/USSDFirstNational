const readline = require('readline');

const URL = process.env.USSD_URL || 'http://localhost:3000/ussd';
const phoneNumber = process.env.USSD_PHONE || '+27831234567';
const sessionId = `sim-${Date.now()}`;

let text = '';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function send() {
  const body = new URLSearchParams({ sessionId, phoneNumber, text });
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const reply = await res.text();
  const ended = reply.startsWith('END');
  console.log(`\n${reply.replace(/^(CON|END) /, '')}\n`);
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
    text = text === '' ? answer : `${text}*${answer}`;
    prompt();
  });
}

console.log(`Dialing USSD... (session ${sessionId}, phone ${phoneNumber})`);
prompt().catch((err) => {
  console.error('Simulator error:', err.message);
  console.error('Is the server running? Try `npm run dev` in another terminal first.');
  rl.close();
});
