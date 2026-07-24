# Progress Tracker

Last updated: 2026-07-07

Status key: `[x]` done · `[~]` partial/mocked (documented) · `[ ]` not started

## Domain

Rebuilt from the earlier telco-banking prototype (Check Balance / Buy
Airtime / My Account) into the actual service being shipped: a **merchant
support** USSD menu — Log a Query, Log Complaint, Request Speedpoint, Track
Query — matching the provided flow document. Company name, short code, and
Service Reference prefix are placeholders (`APP_NAME` / `COMPANY_CODE` in
`.env.example`); see README's "Environment variables" section for what to
swap in before going live.

## 4.1 Session Store

- [x] Unchanged from the prototype — session store abstraction
      (`src/session/sessionStore.js`) with `memoryStore.js` (dev/demo) and
      `redisStore.js` (real use), TTL-based, stateless app layer.

## 4.2 Menu Design (UX)

- [x] Menu state map documented in `docs/MENU_FLOW.md` before flows were coded.
- [x] Every screen automatically checked to stay within 182 characters
      (`tests/menuLength.test.js`).
- [x] Generic `0` = Back / `00` = Exit on every non-root screen, implemented
      once in the router.
- [x] Four flows implemented:
  - **Log a Query**: 6 categories (Battery Issues, Banking Issues, Device
    Faulty [Printer/Connection sub-menu], Speedpoint Rolls, Training, Other
    [free-text details]) → Merchant ID → Alternative Contact → SR
    confirmation.
  - **Log Complaint**: free-text details → Merchant ID → Alternative
    Contact → SR confirmation.
  - **Request Speedpoint**: New / Additional (→ Merchant ID) or Replacement
    (→ Terminal ID instead) → Alternative Contact → SR confirmation.
  - **Track Query**: SR number → assigned/status message, or a clean
    re-prompt on an unrecognised SR.

## 4.3 Timeout Handling

- [x] Unknown/expired `sessionId` with non-empty `text` → clean `END`, never
      a crash or a guessed restart.
- [x] Tickets (query, complaint, speedpoint request) are only created on the
      final confirmed step (`..._CONTACT` state) — a session dying at any
      earlier step leaves zero side effects.
- [x] All exceptions caught centrally (`src/middleware/errorHandler.js`);
      `/ussd` always responds with a clean `END` even on an unhandled error.

## 4.4 Logging & Reliability

- [x] Every request/response pair logged as one structured `ussd_interaction`
      event (sessionId, phoneNumber, input, response, timestamps, state
      transition) via Winston, JSON, to file + console — no request goes
      unlogged.
- [x] Generic `http_request` access log for every HTTP call
      (`src/middleware/requestLogger.js`).
- [x] Malformed payloads (missing `sessionId`/`phoneNumber`) logged with
      context and answered with a clean `END`, not a crash.
- [x] No secrets currently collected by any flow, so `STATES.SENSITIVE` is
      empty; the redaction hook stays wired in `src/ussd/controller.js` for
      the day a flow does collect one.
- [ ] Log aggregation / querying in a real log platform — out of scope for
      the prototype; logs are structured JSON so this is a transport change.

## 5. Non-Functional Requirements

- [x] Stateless app layer — all session state lives in the session store
      (once `SESSION_STORE=redis` is set); horizontal scaling needs no
      sticky sessions.
- [x] Environment-based config (`src/config/index.js` + `.env`), nothing
      hardcoded; `.env` is gitignored, `.env.example` documents every var
      including the placeholders that must be swapped before go-live.
- [x] Fast by construction — mock ticket service is an in-memory `Map` with
      O(1) create/lookup, no artificial latency; needs re-verification once
      a real ticketing/CRM backend is wired in.

## 7. Deliverable (Prototype)

- [x] Working Express server implementing the `/ussd` webhook (`CON`/`END`).
- [x] All four merchant flows end-to-end.
- [x] Structured logging in place.
- [x] Automated tests: session store behaviour, full flow coverage (happy
      paths for all 4 flows, Device Faulty sub-menu, Other free-text path,
      invalid Merchant ID retry, unknown SR retry, back navigation, exit,
      expired session, malformed payload), menu-length regression guard.
      33 tests passing.
- [x] Node.js installed and verified in this environment (`node -v` →
      v24.18.0); `npm install` / `npm test` run successfully.

## 6. External Integrations

- [x] **SendGrid email notifications** — `src/services/emailService.js` sends a
      support-team email on every ticket creation (`sendViaSendGrid`, picked
      automatically when `SENDGRID_API_KEY` is set). Verified end-to-end with a
      real SendGrid account: a real email was delivered for a real ticket.
      Fire-and-forget with retry so a slow/failed send never blocks or fails the
      USSD response itself.
- [x] **SR tracking / recall** — Track Query flow lets a caller pick from their
      own recent tickets (`ticketService.listByPhone`) instead of retyping an SR
      number, confirmed working end-to-end.
## API Comviva

Real telco gateway integration (doc: `Comviva_IM-Service-Creation_PULL_HTTP_INTERFACE.pdf`,
Mahindra Comviva VAS Cloud-Service-Creation / "IM-Service-Creation" / FLARES
framework). Different wire protocol from the Africa's Talking-style webhook
currently implemented at `POST /ussd` (`src/ussd/controller.js`) — needs a new
adapter layer, not a tweak. Existing flow/state logic (`src/ussd/router.js`,
`src/ussd/flows/*`) and the session store don't change — only a new
controller/adapter layer translating between the gateway's contract and our
internal session model.

Buildable now, using the doc's placeholder field names as configurable
defaults (same pattern as `APP_NAME`/`COMPANY_CODE`):

- [x] 1. Config layer — env vars for every configurable Comviva tag (MSISDN,
      Session Id, Subscriber Input, New Request, userid/password tags,
      charge/amount/menu-code headers), defaulted to the doc's sample names.
      `src/config/index.js` `comviva` block + `.env.example`. Verified: loads
      correctly, all 34 existing tests still pass.
- [x] 2-6. `src/ussd/comvivaController.js` — new adapter controller. Built as
      one unit since a controller that parses the request but can't send a
      valid response isn't testable in pieces:
  - [x] 2. Parses `req.query` (not body) using the configured tag names,
        calls the existing `route()` function unchanged — no changes to
        flows/router.
  - [x] 3. Response translator — builds `Freeflow`/`charge`/`amount`/`cpRefId`
        headers + plain-text body from the same `result` object the flows
        already return. (Response `menu code` header intentionally not set —
        that's for gateway-templated menus; our flows render their own text,
        so it doesn't apply.)
  - [x] 4. Auth check — validates userid/password query params against
        `COMVIVA_USER_ID`/`COMVIVA_PASSWORD`; rejects with `401` on mismatch.
        Passes through with a warning-free no-op if those env vars are still
        blank (node not yet provisioned), so the adapter is testable before
        Comviva hands over real credentials.
  - [x] 5. Cleanup request handler — detects `clean`/`status` query params,
        deletes the session from `sessionStore`, responds bare `200 OK`.
  - [x] 6. Route wiring — `POST /ussd/comviva` added in `src/app.js`
        alongside the existing `/ussd`; `src/middleware/errorHandler.js`
        updated so a crash on this route fails in the Comviva header/body
        shape instead of the Africa's Talking `CON`/`END` one.
  - Two judgment calls made where the doc doesn't pin down our specific
    node (documented as comments at the top of `comvivaController.js`):
    session key falls back to MSISDN when no Session Id is present (the
    doc's own Cleanup Request sample has no session id, only MSISDN); "is
    this session new" is inferred from whether we already have a stored
    session, not from trusting the undocumented "New Request" flag encoding.
  - Verified by hand: dial-in → menu → next step → cleanup → malformed
    request (400) → auth reject (401) / auth accept, all against a running
    server, all producing the correct headers/body/status code.
- [x] 7. Tests — `tests/comviva.protocol.test.js`, 9 tests: main-menu headers
      (`Freeflow`/`charge`/`amount`/`cpRefId`), a full Log a Query flow ending
      `FB` with an SR number, invalid-Merchant-ID retry staying `FC`, back/exit,
      recovery-to-main-menu on an unknown session (documents the intentional
      difference from the Africa's Talking route's "session expired" error —
      Comviva's `input` isn't cumulative, so there's nothing to lose by
      restarting clean), malformed request (400), wrong credentials (401),
      and cleanup deleting the session both with and without a Session Id
      present (the doc's own cleanup sample has no session id, only MSISDN).
      Full suite: 43/43 passing.
- [x] 8. README updated — new intro section on the two adapters, a full
      "The Comviva route" section (request/response shape, cleanup, env
      config, how to try it locally via `npm run simulate:comviva`), test
      coverage description, project structure tree, mocked/out-of-scope
      note, and the `COMVIVA_*` placeholder callout in "Environment
      variables". PROGRESS.md itself has carried this checklist throughout.

**All 8 steps buildable without the client's reply are now done.** Fully
blocked on the client/Comviva integration team's answers (email sent
2026-07-21) before this can be pointed at the real gateway.

Blocked on the client/Comviva integration team (email sent 2026-07-21) —
needed before pointing this at the real gateway, not before building it:
real field/tag names for our node, our endpoint URL, real userid/password
credentials, our Unique Identifier/Multi Access Code, confirmation that
charge/amount should always be `N`/`0`, and sandbox access.

Where each answer goes once it lands (`.env`, never `.env.example`):
- Field/tag names, credentials, charging → overwrite the matching `COMVIVA_*`
  var (see `.env.example` for the full list).
- Endpoint URL, sandbox access, timeouts/retry → no file — these are
  deployment/ops facts (our public URL, which environment we're pointed at),
  not app config.
- **Node identifiers**: placeholder tags added 2026-07-21 —
  `COMVIVA_UNIQUE_ID_TAG`/`COMVIVA_MULTI_ACCESS_CODE_TAG`, read in
  `comvivaController.js` and captured in the `ussd_interaction` log for
  traceability, but nothing currently validates or acts on their value
  since it's still unconfirmed whether the app needs to. If Comviva
  confirms it does, that's new logic, not just a value swap.

## Explicitly out of scope this phase

- Real telco/gateway onboarding and production credentials.
- Real ticketing/CRM execution — `src/services/ticketService.js` is a
  documented in-memory mock (SR numbers generated locally, reset on
  restart).
- Multi-language support.
- SMS / USSD push notifications.

## Next steps

1. `npm run dev` + ngrok + Africa's Talking simulator to walk through a live
   demo (steps in `README.md`).
2. [ ] Stand up a real Redis instance, set `SESSION_STORE=redis` in `.env`,
   and re-run the flow tests against it (`REDIS_URL` already has a sane
   local default). Deliberately deferred on 2026-07-21 — in-memory is fine
   for a single-instance first round of real-phone testing where the server
   isn't restarting mid-session, but must happen before this becomes an
   ongoing pilot: in-memory loses every active session on any restart/deploy
   and doesn't share state if more than one instance ever runs.
3. Replace `ticketService.js` with the real ticketing/CRM integration behind
   the same function signatures — no USSD flow code should need to change.
4. Swap `APP_NAME` and `COMPANY_CODE` placeholders for the real values.
