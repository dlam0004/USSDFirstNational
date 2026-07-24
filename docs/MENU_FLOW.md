# Menu Flow / State Map

Documented per requirement 4.2 — the structure below was designed before any
flow's code was implemented, and any new branch must be added here first.

## Conventions

- `0` = Back (returns to the previous screen; not shown on the root menu)
- `00` = Exit (ends the session immediately from anywhere)
- Every screen is rendered by exactly one state's `render()`, and every state
  lives in `src/ussd/states.js` / `src/ussd/flows/`.

## State map

```
MAIN
  1 -> LOG_QUERY_CATEGORY
  2 -> LOG_COMPLAINT_DETAILS
  3 -> SPEEDPOINT_CATEGORY
  4 -> TRACK_QUERY_LIST     (fetches the caller's recent tickets by phoneNumber)

LOG_QUERY_CATEGORY                (0 -> MAIN)
  1 (Battery Issues)    -> LOG_QUERY_MERCHANT_ID
  2 (Banking Issues)    -> LOG_QUERY_MERCHANT_ID
  3 (Device Faulty)     -> DEVICE_FAULTY_CATEGORY
  4 (Speedpoint Rolls)  -> LOG_QUERY_MERCHANT_ID
  5 (Training)          -> LOG_QUERY_MERCHANT_ID
  6 (Other)             -> LOG_QUERY_MERCHANT_ID (then LOG_QUERY_OTHER_DETAILS)

DEVICE_FAULTY_CATEGORY            (0 -> LOG_QUERY_CATEGORY)
  1 (Printer)     -> LOG_QUERY_MERCHANT_ID
  2 (Connection)  -> LOG_QUERY_MERCHANT_ID

LOG_QUERY_MERCHANT_ID             (0 -> LOG_QUERY_CATEGORY or DEVICE_FAULTY_CATEGORY)
  <valid Merchant ID> -> LOG_QUERY_OTHER_DETAILS   (if category == "Other")
  <valid Merchant ID> -> LOG_QUERY_CONTACT         (every other category)

LOG_QUERY_OTHER_DETAILS           (0 -> LOG_QUERY_MERCHANT_ID)
  <free text>          -> LOG_QUERY_CONTACT

LOG_QUERY_CONTACT                 (0 -> LOG_QUERY_MERCHANT_ID or LOG_QUERY_OTHER_DETAILS)
  <valid contact #>    -> creates ticket -> END "Thank you ... SR number is: ..."

LOG_COMPLAINT_DETAILS              (0 -> MAIN)
  <free text>          -> LOG_COMPLAINT_MERCHANT_ID

LOG_COMPLAINT_MERCHANT_ID          (0 -> LOG_COMPLAINT_DETAILS)
  <valid Merchant ID>  -> LOG_COMPLAINT_CONTACT

LOG_COMPLAINT_CONTACT              (0 -> LOG_COMPLAINT_MERCHANT_ID)
  <valid contact #>    -> creates ticket -> END "Thank you ... SR number is: ..."

SPEEDPOINT_CATEGORY                (0 -> MAIN)
  1 (New Speedpoint)         -> SPEEDPOINT_MERCHANT_ID
  2 (Additional Speedpoint)  -> SPEEDPOINT_MERCHANT_ID
  3 (Replacement)            -> SPEEDPOINT_TERMINAL_ID

SPEEDPOINT_MERCHANT_ID             (0 -> SPEEDPOINT_CATEGORY)
  <valid Merchant ID>  -> SPEEDPOINT_CONTACT

SPEEDPOINT_TERMINAL_ID             (0 -> SPEEDPOINT_CATEGORY)
  <valid Terminal ID>  -> SPEEDPOINT_CONTACT

SPEEDPOINT_CONTACT                 (0 -> SPEEDPOINT_MERCHANT_ID or SPEEDPOINT_TERMINAL_ID)
  <valid contact #>    -> creates ticket -> END "Thank you ... SR number is: ..."

TRACK_QUERY_LIST                   (0 -> MAIN)
  Shows the caller's own recent tickets (matched by phoneNumber), newest
  first, capped at 5 — no typing an SR number.
  <valid list number>      -> END "Your query has ... an <STATUS> status."
  <invalid/out-of-range>   -> re-prompt (stays on this state)
  <no tickets for number>  -> "You have no recent queries." (0 -> MAIN only)
```

## Design notes

- **Depth is capped at 5 screens** for any single flow (Log a Query -> Device
  Faulty -> Merchant ID -> Contact is the deepest simple case; Other adds one
  more screen for free-text details).
- **Tickets are only created on the final confirmed step** — `logQuery()`,
  `logComplaint()`, and `requestSpeedpoint()` are each called exactly once,
  from the flow's `..._CONTACT` state. If the session dies at any earlier
  step, nothing has been logged as a ticket (requirement 4.3).
- **Back-navigation is generic**, implemented once in `src/ussd/router.js`
  using a per-session stack of visited states, not hand-rolled per flow. This
  is why branching (e.g. Device Faulty, or Other's extra details screen)
  "just works" for `0` without special-casing.
- Screen text is kept short and jargon-free; see `tests/menuLength.test.js`
  for the automated 182-character guard against copy creep.
- Merchant ID / Terminal ID validation and the 140-character cap on free-text
  details both live in `src/ussd/flows/shared.js` so the rule is defined once.
- **Track Query lists tickets instead of asking for a typed SR number.** A
  real USSD session has no copy/paste, so requiring the caller to retype an
  SR they only saw once on a prior screen is a common source of typos. Since
  every ticket already stores `phoneNumber`, `ticketService.listByPhone()`
  looks theirs up directly.

## Adding a new flow

1. Add the new state name(s) to `src/ussd/states.js` (and to `SENSITIVE` if
   the input is a PIN or other secret).
2. Update this document with the new branch before writing code.
3. Add a module under `src/ussd/flows/` exporting `{ render, handle }` per
   state, and register it in `src/ussd/flows/index.js`.
4. A length check will run automatically via `tests/menuLength.test.js`;
   add a flow test in `tests/ussd.flow.test.js` covering the happy path plus
   one invalid-input case.
