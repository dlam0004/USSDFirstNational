// Sends a notification email to the support team every time a ticket is
// created. Deliberately fire-and-forget from the caller's side (see
// ticketService.js) — a USSD gateway times out in seconds, so nothing here
// may ever block or fail the USSD response. If the send fails after retries,
// it's logged; the ticket itself is already saved regardless.

const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../config/logger');

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// Four modes, picked automatically so nothing needs configuring for local
// dev/demo, and nothing needs code changes to go to production:
//   1. test      — NODE_ENV=test: no network at all, just builds the message.
//   2. sendgrid  — SENDGRID_API_KEY is set: real send over HTTPS (preferred —
//                  SMTP is commonly blocked outbound by cloud hosts and
//                  corporate networks; HTTPS is not).
//   3. smtp      — SMTP_HOST is set: real send via a mail server, for when
//                  the client mandates their own relay instead of SendGrid.
//   4. dev       — nothing configured: auto-creates a free Ethereal test
//                  inbox (https://ethereal.email) so you can view real
//                  emails without any credentials. Not for production — mail
//                  never leaves Ethereal's sandbox.
function pickMode() {
  if (config.env === 'test') return 'test';
  if (config.sendgrid.apiKey) return 'sendgrid';
  if (config.smtp.host) return 'smtp';
  return 'dev';
}

let transporterPromise;

function getNodemailerTransport(mode) {
  if (transporterPromise) return transporterPromise;

  if (mode === 'test') {
    transporterPromise = Promise.resolve(nodemailer.createTransport({ jsonTransport: true }));
  } else if (mode === 'smtp') {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      })
    );
  } else {
    transporterPromise = nodemailer.createTestAccount().then((account) => {
      logger.info('email_dev_mode', {
        message: 'No SENDGRID_API_KEY/SMTP_HOST configured — using a free Ethereal test inbox for local dev.',
        inboxUser: account.user,
      });
      return nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      });
    });
  }
  return transporterPromise;
}

async function sendViaSendGrid(subject, text) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.sendgrid.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: config.supportEmail }] }],
      from: { email: config.sendgrid.fromEmail },
      subject,
      content: [{ type: 'text/plain', value: text }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SendGrid ${res.status}: ${body.slice(0, 300)}`);
  }
}

async function sendViaNodemailer(mode, subject, text) {
  const transport = await getNodemailerTransport(mode);
  const info = await transport.sendMail({ from: config.smtp.from, to: config.supportEmail, subject, text });
  return mode === 'dev' ? nodemailer.getTestMessageUrl(info) : undefined;
}

function ticketTypeLabel(ticket) {
  if (ticket.type === 'query') return 'Query';
  if (ticket.type === 'complaint') return 'Complaint';
  if (ticket.type === 'speedpoint') return 'Speedpoint Request';
  return ticket.type;
}

function formatTicketEmail(ticket) {
  const lines = [
    `Type: ${ticketTypeLabel(ticket)}`,
    `SR Number: ${ticket.sr}`,
    `Status: ${ticket.status}`,
    ticket.category ? `Category: ${ticket.category}` : null,
    ticket.speedpointType ? `Speedpoint Type: ${ticket.speedpointType}` : null,
    `Caller Number: ${ticket.phoneNumber}`,
    `Alternative Contact: ${ticket.contact}`,
    ticket.merchantId ? `Merchant ID: ${ticket.merchantId}` : null,
    ticket.terminalId ? `Terminal ID: ${ticket.terminalId}` : null,
    ticket.details ? `Details: ${ticket.details}` : null,
    `Logged At: ${ticket.createdAt}`,
  ].filter(Boolean);

  return {
    subject: `[${config.companyCode}] New ${ticketTypeLabel(ticket)} — ${ticket.sr}`,
    text: lines.join('\n'),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWithRetry(ticket, attempt = 1) {
  const mode = pickMode();
  const { subject, text } = formatTicketEmail(ticket);

  try {
    let previewUrl;
    if (mode === 'sendgrid') {
      await sendViaSendGrid(subject, text);
    } else {
      previewUrl = await sendViaNodemailer(mode, subject, text);
    }
    logger.info('ticket_email_sent', { sr: ticket.sr, mode, previewUrl });
  } catch (err) {
    if (attempt < RETRY_ATTEMPTS) {
      await delay(RETRY_DELAY_MS * attempt);
      return sendWithRetry(ticket, attempt + 1);
    }
    logger.error('ticket_email_failed', { sr: ticket.sr, mode, attempts: attempt, error: err.message });
  }
}

// Intentionally not awaited by callers — see ticketService.js.
function notifyTicketCreated(ticket) {
  return sendWithRetry(ticket).catch((err) => {
    logger.error('ticket_email_failed', { sr: ticket.sr, error: err.message });
  });
}

module.exports = { notifyTicketCreated };
