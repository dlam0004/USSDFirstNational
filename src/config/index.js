require('dotenv').config();
//TODO: SANDBOX access: changes for this; it just determines where we test once it exists.
//Node Identifiers-- purely configured on Comviva's side 
//ENDPOINT URL: we expose POST /ussd/comviva, our server public address + path
//Short code: *1140#

const env = process.env.NODE_ENV || 'development';

module.exports = {
  env,
  isProduction: env === 'production',
  port: Number(process.env.PORT) || 3000,
  appName: process.env.APP_NAME || 'Acme',

  // Short prefix used when generating Service Reference numbers, e.g.
  // "<companyCode>-MS-1102". Replace with the real merchant services code.
  companyCode: process.env.COMPANY_CODE || 'ACME',

  // "memory" for local dev/demo only; "redis" is required for real/production use
  // so that sessions survive restarts and work across multiple instances.
  sessionStoreType: process.env.SESSION_STORE || 'memory',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',

  // Should match/slightly exceed the gateway's own session timeout window.
  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS) || 180,

  logLevel: process.env.LOG_LEVEL || 'info',
  logDir: process.env.LOG_DIR || 'logs',

  // Every ticket (query/complaint/speedpoint request) is emailed here so the
  // client's support team sees it land, in addition to it being saved by
  // ticketService. Replace with the real support inbox before going live.
  supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',

  // Preferred path to production: SendGrid's HTTP API (port 443), not SMTP.
  // Raw SMTP (port 25/587/465) is commonly blocked outbound by cloud hosts
  // and corporate networks; an HTTPS API call is not.
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || '',
  },

  // Fallback path if the client mandates their own mail relay instead of
  // SendGrid. Leave unset for local dev/demo: emailService falls back
  // to a free, zero-config test inbox (Ethereal) so you can see real emails
  // without any credentials, and to a no-network no-op while running tests.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'USSD App <no-reply@example.com>',
  },

  // Mahindra Comviva VAS Cloud-Service-Creation HTTP(S) Pull Protocol.
  // Every "*Tag" value is the query-string/header KEY the gateway is
  // configured to use for our node, not the value it sends — Comviva's own
  // doc states these are configurable per node through their GUI. The
  // defaults below are the doc's generic sample names; swap them for the
  // real ones once the Comviva/Mahindra integration team confirms our
  // node's configuration (see PROGRESS.md "API Comviva").
  comviva: {
    //// doc states these are configurable per node through their GUI *****
    /*
    defaults below are the doc's generic sample names; swap them for the
  // real ones once the Comviva/Mahindra integration team confirms our
  // node's configuration
    */
    tags: {
      msisdn: process.env.COMVIVA_MSISDN_TAG || 'MSISDN',
      sessionId: process.env.COMVIVA_SESSION_ID_TAG || 'sessionId',
      input: process.env.COMVIVA_INPUT_TAG || 'input',
      newRequest: process.env.COMVIVA_NEW_REQUEST_TAG || 'newRequest',
      userId: process.env.COMVIVA_USERID_TAG || 'userid',
      password: process.env.COMVIVA_PASSWORD_TAG || 'password',
      clean: process.env.COMVIVA_CLEAN_TAG || 'clean',
      status: process.env.COMVIVA_STATUS_TAG || 'status',
      // Node Unique Identifier / Multi Access Code (doc params 12-13) — not
      // yet confirmed whether our app needs to read/validate these or
      // they're purely Comviva-internal routing config. Captured in the
      // ussd_interaction log if present so we have a trail either way, but
      // nothing currently depends on their value.
      uniqueId: process.env.COMVIVA_UNIQUE_ID_TAG || 'uniqueId',
      multiAccessCode: process.env.COMVIVA_MULTI_ACCESS_CODE_TAG || 'multiAccessCode',
    },
    // Cleanup requests carry a fixed message value in the "clean" param
    // (see doc's Cleanup Request sample), not just any non-empty value.
    cleanMessage: process.env.COMVIVA_CLEAN_MESSAGE || 'clean-session',
    // Credentials the gateway must present on every request (doc params
    // 20-23: User tag/Password tag/User Id/Password). Blank until Comviva
    // provisions our node — see auth check in the adapter controller.
    //TODO:CREDENTIALS - Currently empty, checked in authenticated() --Ccontroller.js
    auth: {
      userId: process.env.COMVIVA_USER_ID || '',
      password: process.env.COMVIVA_PASSWORD || '',
    },
    // Response header names (doc's "parameters which applications can send
    // as response headers" table) — same caveat, confirm before go-live.
    responseHeaders: {
      freeflow: process.env.COMVIVA_FREEFLOW_HEADER || 'Freeflow',
      charge: process.env.COMVIVA_CHARGE_HEADER || 'charge',
      amount: process.env.COMVIVA_AMOUNT_HEADER || 'amount',
      cpRefId: process.env.COMVIVA_CPREFID_HEADER || 'cpRefId',
      menuCode: process.env.COMVIVA_MENUCODE_HEADER || 'menucode',
    },
    // This is a free merchant-support line — never charge the subscriber.
    // Flip only if the client explicitly confirms otherwise for this service.

    //** TODO:defaulted to no charge for now until Comviva changes*/
    charge: {
      enabled: process.env.COMVIVA_CHARGE_ENABLED === 'true',
      amount: Number(process.env.COMVIVA_CHARGE_AMOUNT) || 0,
    },
  },
};
