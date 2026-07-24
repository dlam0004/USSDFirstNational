# USSD App

A USSD backend service for merchant support (Log a Query, Log Complaint,
Request Speedpoint, Track Query). It manages session-based menu navigation
behind two interchangeable gateway adapters — the flows, router, and session
store don't know or care which one is in front of them:

- `POST /ussd` — Africa's Talking-compatible: form body
  (`sessionId`/`phoneNumber`/`text`), plain-text `CON`/`END` responses.
- `POST /ussd/comviva` — Mahindra Comviva VAS Cloud-Service-Creation HTTP(S)
  Pull Protocol: query-string request, `Freeflow`/`charge`/`amount`/`cpRefId`
  response headers. This is the real telco gateway integration; see "The
  Comviva route" below and `PROGRESS.md`'s "API Comviva" section for what's
  built vs. still pending real credentials from the client.

Company name, short code, and Service Reference prefix are all placeholders
(`APP_NAME` / `COMPANY_CODE` in `.env`) — see "Environment variables" below
for what to swap in before going live.

See [`PROGRESS.md`](./PROGRESS.md) for what's built vs. outstanding, and
[`docs/MENU_FLOW.md`](./docs/MENU_FLOW.md) for the menu state map.

## Requirements

- Node.js 18+
- Redis (only required when `SESSION_STORE=redis`; local dev can run entirely
  without it)

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` as needed — defaults run the whole app locally with no external
dependencies (in-memory session store).

## Running locally (demo mode, in-memory sessions)

```bash
npm run dev
```

The server starts on `http://localhost:3000` by default. Health check:
`GET /health`.

> In-memory sessions are for local dev/demo only — state is lost on restart
> and isn't shared across instances. Anything beyond a same-day demo must run
> with `SESSION_STORE=redis`.

## Running with Redis (production-shaped)

```bash
docker run -p 6379:6379 --name ussd-redis -d redis:7
```

Then in `.env`:

```
SESSION_STORE=redis
REDIS_URL=redis://127.0.0.1:6379
```

```bash
npm start
```

## Demoing via the Africa's Talking simulator + ngrok

1. Start the app: `npm run dev` (default port 3000).
2. Expose it publicly: `ngrok http 3000`, copy the `https://...` forwarding URL.
3. In the [Africa's Talking sandbox](https://account.africastalking.com/),
   create a USSD channel and set its callback URL to
   `https://<your-ngrok-domain>/ussd`.
4. Open the sandbox's USSD simulator, enter a test phone number, and dial the
   service code. You should see the main menu render within the simulator.
5. Walk through: **Log a Query** (any category, or Other for free-text),
   **Log Complaint**, **Request Speedpoint** (New/Additional ask for a
   Merchant ID, Replacement asks for a Terminal ID instead), or **Track
   Query** using the SR number returned by any of the above.

## The Comviva route

`POST /ussd/comviva` implements the Mahindra Comviva VAS Cloud-Service-Creation
HTTP(S) Pull Protocol — the client's real telco gateway. It drives the exact
same flows/router/session store as `/ussd`; only the request/response shape
differs:

- **Request**: the gateway calls with POST, but every parameter (MSISDN,
  Session Id, Subscriber Input, userid/password, ...) arrives as a
  **query-string** key, not a form/JSON body.
- **Response**: HTTP 200, the message as plain body text, and control info as
  headers — `Freeflow` (`FC`=continue, `FB`=end, replacing `CON`/`END`),
  `charge`, `amount`, `cpRefId`.
- **Cleanup**: a network session abort sends a separate request
  (`clean=clean-session&status=<code>`) instead of relying on our TTL expiry;
  we respond with a bare `200 OK`.

**Every field/tag name is env-configurable** (`src/config/index.js`'s
`comviva` block, `.env.example`'s `COMVIVA_*` vars) because Comviva's own doc
states these are configured per node through their GUI — the defaults are
the doc's generic sample names, not confirmed for our node yet. See
`PROGRESS.md`'s "API Comviva" section for exactly what's still outstanding
(real field names, endpoint URL, credentials, node identifiers, charging
sign-off, sandbox access) before this can be pointed at the real gateway.

### Trying it locally

```bash
npm run dev              # terminal 1
npm run simulate:comviva # terminal 2 — same idea as `npm run simulate`,
                          # but speaks the Comviva query-string/header shape
```

Auth is a no-op until `COMVIVA_USER_ID`/`COMVIVA_PASSWORD` are set in `.env`
(so the adapter is testable before Comviva provisions real credentials); once
set, every request must present matching `userid`/`password` query params or
gets a `401`.

## Testing

```bash
npm test
```

Covers: session store behaviour (get/set/delete/TTL expiry), full USSD flows
end-to-end via `supertest` on the `/ussd` route (all four merchant flows,
back navigation with `0`, exit with `00`, invalid Merchant ID / unknown SR
retry, and an unknown/expired `sessionId` never crashing the server), the
`/ussd/comviva` route (correct `Freeflow`/`charge`/`amount`/`cpRefId`
headers, a full flow to a real SR number, auth accept/reject, cleanup
request deleting the session, and its intentionally different recovery
behaviour on an unknown session — see "The Comviva route" above), and a
regression guard that every menu screen stays within the 182-character
budget. 43 tests passing.

## Project structure

```
server.js                       entrypoint: connects session store, starts Express
src/
  app.js                        Express app wiring (middleware, routes)
  config/                       env-based config + Winston logger (incl. comviva.* tags)
  middleware/                   request logging, centralized error handling
  session/                      sessionStore facade + memory/redis backends
  services/ticketService.js     mocked ticketing backend (SR numbers/status) — stubbed per scope
  ussd/
    controller.js               HTTP <-> session <-> router glue; the /ussd webhook
    comvivaController.js        same glue for the /ussd/comviva webhook (Comviva protocol)
    router.js                   generic state-machine engine (0=back, 00=exit)
    states.js                   state name constants + which states hold secrets
    flows/                      one module per menu (render + handle)
scripts/
  simulate.js                   interactive CLI tester for /ussd
  simulateComviva.js            interactive CLI tester for /ussd/comviva
docs/MENU_FLOW.md               menu state map (update before adding new flows)
tests/                          jest + supertest
```

## How the state machine works

Each session (keyed by the gateway's `sessionId`) stores its current `state`
and any data collected so far (e.g. a category, a Merchant ID) in the session
store. Every incoming request carries the *entire* accumulated `text` history
per the USSD protocol (`1*2*10111`), but since the app already tracks state
itself, only the last segment is treated as new input — there's no
re-parsing of history on every request.

`0` (back) and `00` (exit) are handled once, generically, in
`src/ussd/router.js` using a per-session stack of previously-visited states.
Individual flow modules never implement navigation themselves — they just
validate input and say what state comes next.

Tickets (query, complaint, speedpoint request) are only created on the final
confirmed step of their flow, never incrementally — so a session that dies
mid-flow never leaves a half-logged ticket.

## Logging

Structured JSON logs (Winston) go to `logs/combined.log`, `logs/error.log`,
and the console. Every USSD request/response pair is logged as a single
`ussd_interaction` event with `sessionId`, `phoneNumber`, `input`, `response`,
and state transition — every request is logged, none are dropped. A generic
`http_request` event (method/path/status/latency) is also logged for every
HTTP call via `src/middleware/requestLogger.js`. If a future flow collects a
secret (PIN, OTP), add its state to `STATES.SENSITIVE` in
`src/ussd/states.js` and the controller will redact it to `****` in logs
automatically — no flow currently needs this.

## What's mocked / out of scope for this phase

- `src/services/ticketService.js` is an in-memory mock — no real CRM/case
  management integration (Salesforce, Zendesk, or an internal ticketing API).
  SR numbers and ticket status are made up locally and reset on restart.
- The `/ussd/comviva` adapter is built and tested against Comviva's own
  generic protocol doc, but not yet connectable to the real gateway — that's
  waiting on the client/Comviva integration team to confirm our node's real
  field names, endpoint URL, credentials, node identifiers, and charging
  behaviour (see `PROGRESS.md`'s "API Comviva" section).
- No multi-language support.
- No SMS/USSD push notifications.

## Environment variables

See [`.env.example`](./.env.example) for the full list (port, app name,
session store type, Redis URL, session TTL, log level/dir).

**Before going live, replace these placeholders:**
- `APP_NAME` — real company name shown on the main menu header.
- `COMPANY_CODE` — real short code used to prefix Service Reference numbers
  (e.g. `COMPANY_CODE-MS-1102`).
- The real USSD short code (e.g. `*1140#`) is assigned by the gateway/telco
  and configured on their side, not in this app — it never appears in code.
- All `COMVIVA_*` vars — every one is a placeholder from Comviva's generic
  protocol doc, not confirmed for our node. Do not point `/ussd/comviva` at
  the real gateway until the Comviva/Mahindra integration team confirms
  these (see `PROGRESS.md`'s "API Comviva" section for the exact list).

No secrets or environment-specific URLs are hardcoded anywhere in source.
