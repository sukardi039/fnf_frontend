# Backend change request: pickup order preparation and collection

## Implementation status

### Unified session expiry — web, PDA and customer mobile (2026-10-10)

PDA login QR challenges are one-use, separate from session validity. Frontend
effect replay (including React StrictMode) now reuses a single in-flight exchange
per mounted challenge and ignores results after leaving that challenge page.
Do not resend the exchange on render/navigation/translation dependency changes.
An actually consumed/expired challenge still requires a fresh QR; this fix does
not extend its lifetime or bypass backend challenge validation.

Challenge creation must also bind the intended login interface. The web WA
simulator sends `X-Session-Interface: PDA` to `/api/mobile-logins/request` for
both PDA QR and its equivalent link response; OTP requests WEB. Keep the
simulator's authentication credential scoped to its existing WEB session:
challenge intent is not a switch to PDA credentials. Backend challenge creation
already stores this interface and PDA exchange rejects WEB/LEGACY challenges.
Previously generated wrong-interface challenges cannot be reused; generate a
fresh PDA QR after this frontend fix. Keep backend interface validation intact.
Backend error envelopes use `errorCode`; frontend now recognizes terminal
session codes there as well as `code`, without treating PDA_CHALLENGE_INVALID
as expiry of an established session.

**Backend changes required.** Configure independent absolute session validity
from backend issuance time, not browser timers:

```dotenv
AUTH_WEB_SESSION_TTL_SECONDS=1800
AUTH_PDA_SESSION_TTL_SECONDS=43200
AUTH_MOBILE_SESSION_TTL_SECONDS=2592000
```

These are 30 minutes, 12 hours and 30 days respectively. Bind through backend
application configuration with these defaults and positive-integer validation.
The expiry is an absolute limit: ordinary API activity/refresh must not silently
extend it. If an idle timeout is added later, document it separately. Return
server `sessionExpiresAt` and session interface with authentication responses.
Access-token and cookie lifetime/refresh policy must respect the same session
deadline, never let a refresh outlive or revive the expired/revoked session.

Frontend attaches `X-Session-Interface: WEB|PDA|MOBILE` on shared API requests,
including login. Web password/register/OTP login requests WEB; PDA QR exchange
requests PDA; customer login/register and owner APIs request MOBILE.
This header is routing context, **not authorization or a client-granted TTL**.
Backend binds the allowed interface to the authenticated login flow/session:
customer principal can only receive MOBILE, PDA staff exchange can receive PDA,
web login/OTP exchange receives WEB as permitted by server policy. Reject
cross-interface credentials/mismatches; arbitrary header changes cannot obtain
a longer session or substitute a customer/staff identity.

Use separate server session IDs/cookies (and refresh-cookie names or paths)
per interface so a PDA/customer login cannot overwrite web's session cookie,
and expiry for one interface does not destroy another valid session.
Frontend transitional bearer storage is separated: web `auth_token`, PDA
`pda_auth_token`, mobile `customer_auth_token`. PDA profile remains
`pda_user_info`; web/customer profiles stay separate. Do not automatically
import the previous shared web token as a PDA token. Invalidate/migrate old
shared sessions safely at rollout and require a fresh PDA login.
HttpOnly cookies cannot be deleted by JavaScript: backend must expire the
affected access/refresh cookies and invalidate its server session on expiry/
revocation, preserving other interfaces' cookies. Secure/SameSite, ownership,
company/store authorization and staff audit remain mandatory.

Backend signals terminal session expiry with HTTP 401 and a stable error:

```json
{
  "code": "SESSION_EXPIRED",
  "message": "Session expired. Sign in again."
}
```

Also supported: SESSION_REVOKED and INVALID_SESSION. Return the code on
protected endpoints (including those otherwise reporting 403) for explicit
termination, not a free-text "expired" substring. A collection QR/order expiry
or permissions failure is **not** session expiry: use its business code/403/410.
Invalid login password, login QR or OTP remains a login-form error, not a
redirect loop. If login endpoints explicitly return a session-expiry code,
that code still terminates the affected session.

Frontend now handles protected 401 or those explicit codes **before** any
blocking backend-error dialog, clears the affected interface credentials/
profile, updates authentication state, and replaces navigation immediately:

- WEB → `/login`
- PDA → `/pda/login` with no expired QR key in the URL; show fresh QR/login
  instructions and a link to the login screen rather than an endless spinner.
- MOBILE → `/m/auth`

No acknowledgement click is required. No automatic refresh/replay follows a
terminal signal, including requests with `skipAuthRedirect` or
`skipBackendErrorDialog`. The old VITE_PDA_USE_REFRESH behavior no longer
controls this policy. Late responses from the terminated session are rejected
so they cannot repopulate tokens or report a successful pending operation;
concurrent old-session expiry signals cause only one transition.
Other valid interface credentials remain intact. Pending checkout/review
recovery records are not deleted or interpreted as failure of the transaction:
after reauthentication inspect authoritative order state before retrying.

Backend release checks: verify exact configured deadlines for all three login
flows, independent cookies and interface-binding; protected expiry invalidates
session/cookies; ordinary 403/order-token 410 does not logout; expired sessions
cannot refresh; concurrent requests cannot resurrect a session or repeat a
cash/handover mutation. Verify fresh PDA QR and customer/web login after expiry.
The frontend supports the signal; different durations and cookie invalidation
require deployed backend changes. No backend source was edited by this change.

### Consolidated cash pickup flow (2026-10-09)

PDA navigation now offers one Pickup workflow plus counter Checkout and profile.
The old `/pda/home` collection entry redirects to `/pda/pickup`, preserving an
order-reference query. It no longer calls device-bound `/api/pda/scan/resolve`
or legacy PDA handover. Shared arrival/cash/preparation/verify/handover endpoints
authorize the real staff/system principal and store; a device ID is optional
audit context, not a mandatory input for this shared journey. Do not weaken
staff authentication or store/company authorization.

Cash journey: open the original order, scan/enter arrival QR, explicitly confirm
physical presence, record arrival, receive/confirm cash, allocate lots, prepare,
mark ready, scan/enter the separate collection QR, verify, and confirm handover.
Details explain the next step and show the amount, schedule and terminal
handover result. Camera input reuses the application's scanner with raw token
preservation; scanning only fills an input and never commits arrival or releases
goods. Camera permission/support errors are shown by that scanner; manual input
and hardware-scanner text remain available. Actual phone camera behavior needs
device validation (HTTPS/localhost and browser permission are required).

Opened order references are written into the URL so refresh restores the same
server detail, including handed-over orders no longer in the active queue.
Shared mutation idempotency keys persist in session storage, keyed by a SHA-256
digest of the authenticated bearer session, store, transaction, operation and
payload. Raw QR and receipt-note payloads are not persisted by this mechanism.
Unchanged retries in the same tab/session reuse the key across remounts.
Changing authenticated bearer session or payload yields another key; server
state guards still prevent repeated receipts/handover. This is not cross-device
or browser-restart recovery. A failed action blocks further operations until
staff refresh the authoritative detail; do not infer that a timeout means failure.

Customer checkout stage snapshots/keys persist per customer in session storage.
Reopening checkout resumes the original fixed basket/payment/store/slot instead
of creating another cart. Corrupt/unavailable storage blocks submission with
an explicit error. Acknowledged transaction creation clears recovery data;
an uncertain response must be checked against Orders before retrying with the
original keys. Server idempotency and retention remain mandatory.

E-payment remains development/mock only, including staff detail warnings.
There is no new real payment provider or automatic refund implementation.
The shared APIs exist in the currently inspected sibling backend source, but
deployed behavior is not certified by frontend unit tests.

**Release gate:** run a live cash-order arrival-to-handover journey against the
deployed backend, then validate wrong-store access, expired/wrong-purpose QR,
refresh during uncertain receipt, concurrent expiry/handover and inventory
reconciliation. Persisted receipt/handover actor/time and the authorized
paid-overdue/late-payment review and authorized refund workflow must be exposed
by backend contracts. Current
pickup detail lacks those audit fields; frontend must not invent them.
Do not describe the flow as production-ready until these checks pass.

Customer browser requests must use the customer cookie/session, never a saved
system-user bearer token. The frontend now isolates transitional customer tokens
in session storage from system-user credentials. The customer history filter
remains; the backend must enforce authenticated customer ownership.
Re-login as a customer after upgrading. Previously created transactions under a
system-user session with no customer association will not appear in customer
history; do not automatically reassign them. Investigate and reconcile through
an authorized backend process if needed.

The current backend uses a shared access/refresh cookie across login types.
Concurrent staff/customer cookie logins in the same browser can still replace
one another. Use separate browser profiles for concurrent sessions until the
backend provides purpose-scoped cookies or an authenticated customer-session
endpoint/guard. Customer checkout must reject non-customer principals rather
than create an unowned mobile transaction.

The frontend now provides `/checkout/pickup` (system-user web) and `/pda/pickup`
(staff PDA). **The new pickup APIs below are required before this workflow can
operate.** They are not implemented by this frontend change. Failures are shown
to users; there is no simulated queue, locally persisted preparation, or second
checkout. Existing `/api/transactions` is not a substitute: its current listing
does not filter by store/channel or return sale lines and preparation state.

Existing backend capabilities verified in the sibling backend source:

- `POST /api/transactions/{transactionId}/collection-token`
- `POST /api/pda/scan/resolve`
- `POST /api/pda/transactions/{transactionId}/lot-allocations`
- `POST /api/pda/transactions/{transactionId}/handover`

The existing lot-allocation and handover endpoints have bound staff/device
requirements. Do not route a system-user web session through those endpoints or
invent a staff/device ID. The shared pickup endpoints must authorize their actual
principal and may reuse the domain services after separating principal-specific
authorization.

## Staff counter cash payment: frontend integration implemented

Web/PDA Staff Checkout now completes cash payment on the existing transaction:
`CASH` and `PAY_AT_COUNTER` checkout must return `CASH_PENDING_CONFIRMATION`.
Staff receive the full amount, enter a required confirmation note (1-500
characters), and explicitly select **Confirm cash received**.

The frontend calls the existing
`POST /api/transactions/{transactionId}/confirm-cash` with
`{"confirmationNote": "..."}` and a UUID `Idempotency-Key`. An unchanged failed
confirmation retry reuses that key. A valid response must contain the same
`transactionId`, `state: "READY_FOR_HANDOVER"`, `paymentStatus: "SUCCESS"`,
`confirmedBy` and `confirmedAt`. The original amount and currency remain visible.
Errors leave the transaction pending; Start New Order is disabled while cash
confirmation is pending or in flight. Checkout retries also reuse an unchanged
command's key to avoid duplicate sales.

This uses the existing backend cash endpoint, not the mock e-payment adapter.
Cash confirmation is not physical handover. Mobile pickup cash uses the
store-scoped pickup workflow below, not another Staff Checkout sale.
Pending transaction state and retry keys are currently in component memory;
refreshing/leaving the screen requires separate existing-transaction recovery
support before staff can resume confirmation through the UI.

## Customer mobile correction: frontend implemented, backend enforcement pending

The customer cart fixes the channel to `MOBILE_ORDER` and offers two payment
choices: **Pay cash at collection** (`PAY_AT_COUNTER`, default) and **Pay online**
(`E_PAYMENT`, explicitly labelled development-only while the gateway is mocked).
It shows the selected pickup store and payment-specific collection instructions.
Checkout displays the returned transaction state rather than
claiming payment is complete, and retains the returned payment link and Orders
link. Staff counter checkout is unchanged by this customer correction.

Backend validation, legacy-order rollout and an existing-transaction payment
continuation contract remain required. Removing selectors is not server-side
enforcement. Orders does not yet offer payment-session renewal or retry because
that contract has not been supplied.

### Initial scope: online payment or cash on arrival

- Remove the customer Channel selector. Customer mobile cart creation and
  checkout must always submit `channel: "MOBILE_ORDER"`.
- Use "Store pickup" and show the selected store. Online-paid orders may be
  prepared after authoritative payment confirmation. Cash-on-arrival orders
  are not prepared in advance: staff verify customer arrival, receive and
  confirm cash, then prepare and hand over the same order.
- Allow `E_PAYMENT` and `PAY_AT_COUNTER`, with no separate customer `CASH`
  choice. Online payment remains a mock integration, not a live-money service.
- Snapshot `preparationPolicy: "ON_ARRIVAL"` for every new pay-at-collection
  order. It is server-owned, not a customer-selectable toggle.
- Keep `STAFF_ASSISTED` in authenticated staff counter checkout. Choosing a
  channel as a customer must not impersonate a staff-assisted sale.
- Defer customer `STORE_SELF_SELECT` to a separate in-store self-checkout
  workflow with physical-product scanning, verification and release.
- Preserve the same transaction through payment, preparation and collection.
  A pending or failed payment must not send the customer through a second cart
  or checkout to pay again.

### Backend enforcement

#### Required replacement of the existing online-only restriction

Verified in the sibling backend source on 2026-10-09:
`CheckoutService.checkoutInternal` still rejects authenticated customers when
`paymentMode != E_PAYMENT` and returns
`Customer checkout requires MOBILE_ORDER and E_PAYMENT`.
That is the obsolete online-only policy, not the policy required by this document.
The frontend's default `MOBILE_ORDER` + `PAY_AT_COUNTER` request is therefore
currently rejected before transaction creation.

Replace that customer checkout check with the following allowlist:

| Authenticated principal | Channel | Payment mode | Required result |
| --- | --- | --- | --- |
| `CUSTOMER` | `MOBILE_ORDER` | `PAY_AT_COUNTER` | Allow unpaid pickup order creation; no payment gateway call |
| `CUSTOMER` | `MOBILE_ORDER` | `E_PAYMENT` | Allow online payment initiation; not proof of payment |
| `CUSTOMER` | Any other channel | Any | Reject with 422; do not create a transaction |
| `CUSTOMER` | `MOBILE_ORDER` | Any other payment mode, including raw `CASH` | Reject with 422; do not create a transaction |

For unsupported customer checkout combinations, replace the old error message
with `Customer checkout requires MOBILE_ORDER and E_PAYMENT or PAY_AT_COUNTER`.
Keep the existing `CUSTOMER_CHECKOUT_POLICY` error code.
Do not disable `customerMobileOnlyEnabled` to bypass the obsolete check or remove
the channel/cart-ownership validation. Deploy the allowlist together with the
persisted arrival/payment/preparation safeguards described below; accepting
checkout alone does not complete cash-at-collection fulfillment.

For authenticated `CUSTOMER` calls to `POST /api/carts` and `POST /api/checkout`,
validate the mobile pickup policy server-side. Cart creation must allow only
`MOBILE_ORDER`; payment-mode validation applies at checkout. Checkout must allow
only `MOBILE_ORDER` and payment modes `E_PAYMENT` or `PAY_AT_COUNTER`.
Reject unsupported channels
and payment modes with an explicit 422 response and human-readable `message`;
do not silently relabel the request. Checkout must also verify that the cart
belongs to the customer and has the same `MOBILE_ORDER` channel. Derive customer
ownership from authentication, not a submitted customer ID.

These restrictions apply to the customer mobile journey, not globally to
system-user/staff counter checkout. Do not remove the existing counter-sale
channels or staff payment modes as a side effect.

Define a rollout policy for legacy customer carts/orders using raw `CASH`,
pay-at-counter without preparation policy, or non-mobile channels.
Existing transactions must retain their recorded channel and payment mode;
do not automatically migrate, charge, or cancel them. This change does not
promise fulfillment support for those legacy transactions.
Needs Reconciliation displays legacy raw `CASH`, `PAY_AT_COUNTER` records with
both arrival/policy fields absent, and wholly unscheduled orders. Their detail
response must disable every normal fulfilment mutation action; separately
authorized reconciliation outcomes can record notes, close confirmed-unpaid
orders or restore verified paid orders under the contract below.
Store/channel scope and sale-line validation remain mandatory;
partial/invalid arrival policies are not treated as legacy. Authorized backend
reconciliation is required before legacy fulfillment; no client-side migration.

### Payment continuation and truthful status

Checkout initiation is not proof of successful payment. Show the returned
transaction/payment state and expose the payment provider's redirect URL when
available. Only authoritative payment confirmation may enable preparation.

Customer order history must provide the payment status and, where the provider
supports it, a safe way to resume payment on the **existing transaction**. Define
that continuation contract before claiming failed/pending payments can be
retried from Orders. Expired payment sessions must return an explicit result,
not trigger a new sale implicitly.

Keep payment status separate from `preparationStatus`. Show collection QR/token
actions only for paid, prepared mobile pickup orders; token issuance and both
handover paths must repeat the same checks on the server.

### Acceptance checks for the mobile correction

1. Customer mobile shows the pickup store, no Channel selector, and the two
   payment choices; requests always use `MOBILE_ORDER`.
2. Tampered customer requests using `STAFF_ASSISTED`, `STORE_SELF_SELECT`,
   or raw `CASH` are rejected without creating a sale. `PAY_AT_COUNTER` is allowed.
   Test both accepted customer payment modes with the mobile-only restriction
   enabled. `PAY_AT_COUNTER` must return the unpaid state below, retain the
   authenticated customer's ownership and appear in that customer's history;
   it must not invoke the e-payment adapter or mark payment/preparation successful.
3. Staff counter checkout retains its supported channels and payment modes.
4. Payment-pending orders are not described as paid or ready to collect and
   cannot be prepared or handed over.
5. Payment continuation does not create another cart, transaction or charge
   merely because the customer refreshes or retries.
6. Legacy transactions are not silently reclassified by this correction.

## Pay at collection: preparation only on arrival

**Frontend implemented against the following pending backend contract.**
The chosen initial policy is no advance preparation. Cabinet collection,
payment-triggered compartment unlocking and preparation before arrival are
explicitly out of scope. Future support should add a separate server-owned
policy, not weaken `ON_ARRIVAL` or reinterpret already placed orders.

## Store-managed weekly business hours

**Frontend editor and slot generation implemented; backend persistence required.**
Each store manages its own seven-day schedule in its IANA `timezone`. There is
no global hardcoded closing time. Store Add/Edit supports closed days, multiple
intervals (split shifts) and overnight intervals.

Extend store create/update requests and store list/detail responses with
`businessHours`. Customer store discovery must return the same authoritative
schedule; the frontend must not maintain a separate local-storage copy.
The following shape has every weekday exactly once, with an empty array for
a closed day. `opensAt`/`closesAt` are local 24-hour `HH:mm` values:

```json
{
  "timezone": "Asia/Singapore",
  "businessHours": {
    "MONDAY": [{"opensAt": "09:00", "closesAt": "22:00"}],
    "TUESDAY": [{"opensAt": "09:00", "closesAt": "12:00"}, {"opensAt": "14:00", "closesAt": "22:00"}],
    "WEDNESDAY": [],
    "THURSDAY": [{"opensAt": "09:00", "closesAt": "22:00"}],
    "FRIDAY": [{"opensAt": "20:00", "closesAt": "03:00"}],
    "SATURDAY": [{"opensAt": "09:00", "closesAt": "22:00"}],
    "SUNDAY": [{"opensAt": "09:00", "closesAt": "22:00"}]
  }
}
```

- A closing time earlier than opening means closing on the next calendar day.
  Equal opening/closing is invalid, not an implicit 24-hour interval.
- Reject malformed times, incomplete schedules and overlapping intervals,
  including next-day spillover and the Sunday/Monday boundary. Adjacent
  intervals may touch but remain separate: a pickup plus grace must fit within
  one configured interval. Closed means no interval starting that day; an
  overnight interval from the previous day may still be open after midnight.
- Authorize schedule mutations by the store's company/admin permissions.
  Persist atomically. StoreForm reads back store detail after save to verify
  the schedule actually persisted; missing or different hours are an error,
  not a successful save. If save was acknowledged but verification failed,
  reload the store before retrying, rather than blindly repeating creation.
- Existing stores with missing schedules must be explicitly configured.
  Do not invent default business hours or interpret missing data as always open.
- Weekly hours do not implement holidays/date exceptions yet. Those require a
  future explicit override contract, not silent weekly-schedule reinterpretation.
- New checkout revalidates current hours. Existing accepted transactions retain
  their stored pickup slot and collection due time even if hours later change. An authorized,
  audited reschedule/cancellation process is required to change those orders.
- Resolve overnight dates in the store timezone, using actual instants for
  lead time/durations. Server validation must handle DST offset transitions;
  reject nonexistent local interval endpoints explicitly rather than silently
  shifting opening/closing. ISO checkout instants identify repeated-hour slots.

## Scheduled pickup: replaces the checkout-relative reservation timeout

**Frontend implemented; backend enforcement and persistence required.**
This policy supersedes the current backend
`pickup.cash-reservation.ttl-minutes` default of 30 minutes after checkout.
Do not expire new scheduled orders using that checkout-relative timeout.
Changing its constant to 90 minutes is also incorrect: expiry is relative to
the customer-selected pickup slot, which may be several hours after checkout.

### Customer selection and checkout validation

The customer checkout displays eligible pickup slots as wrapping, tappable
buttons rather than a dropdown. The selected slot is highlighted; once checkout
starts, the original slot remains visible and locked for unchanged retries.
This presentation change does not alter the checkout API contract.
Payment methods also use highlighted, tappable buttons, with pay cash at
collection selected by default. Both buttons are locked once checkout starts;
the online-payment mock warning and existing payment-mode values are unchanged.
Checkout basket lines show product thumbnails using the catalog's
`productPicture` data. Pictures are display-only and are not submitted in
cart-item or checkout commands. Existing basket lines lacking picture data
look up their picture by SKU from the catalog without changing quantities or
recreating the cart. Products without a catalog picture use the placeholder;
lookup failures show a warning without blocking checkout.

- Pickup follows today's **operating intervals**, using the selected store's IANA `timezone`,
  not the browser/server timezone. Missing/invalid timezone or weekly business
  hours must block checkout. A valid all-closed schedule simply has no slots.
- Slots are 30-minute blocks aligned to local `:00` or `:30`.
- The slot start must be at least 90 minutes after authoritative checkout time.
  Round the earliest eligible start **up** to the next half-hour boundary.
- The slot start, 30-minute slot and subsequent 30-minute grace must all fit
  within **one store opening interval**. Both collection and expiry must be
  within business hours: `pickupExpiresAt <= intervalClosingInstant`.
  For 22:00 closing, last slot is 21:00-21:30 and deadline is 22:00. For
  20:00 closing, last slot is 19:00-19:30 and deadline is 20:00. If closing
  is 20:15, last aligned slot is still 19:00-19:30, expiring at 20:00.
- Split-shift gaps offer no slots, including slots whose grace would run into
  the gap. Consider intervals starting today and yesterday's overnight spillover.
  Today's overnight interval may offer slot **starts after midnight tomorrow**,
  provided the full slot and grace fit before that interval closes. Do not offer
  tomorrow's separate opening intervals. Show the pickup start date on buttons
  and order schedules to disambiguate midnight rollover.
- If there are no eligible starts left in those intervals, reject/disable checkout.
  At exactly 19:30:00 a 21:00 start is
  eligible if the store stays open through 22:00; later than that it is not.
- This applies to new customer `MOBILE_ORDER` checkout with either
  `PAY_AT_COUNTER` or `E_PAYMENT`. Staff counter checkout is unchanged.
- Customer `POST /api/checkout` includes `pickupSlotStart`, an ISO-8601 instant
  (frontend sends UTC). Resolve the store from the authenticated customer's
  cart; validate operating-interval membership (including overnight rollover), slot alignment,
  grace-period deadline and 90-minute lead.
  Return explicit 422 errors for missing/invalid/no-longer-eligible slots.
  Do not accept the browser clock or client-calculated expiry as authoritative.
- Derive and persist `pickupSlotEnd = pickupSlotStart + 30 minutes`,
  `pickupExpiresAt = pickupSlotStart + 60 minutes`, and `pickupTimezone` from
  the store. Snapshot these values on the original transaction.
- Include these fields in checkout, customer history, staff queue/details and
  mutation responses. Staff must see the selected slot and collection deadline.
  Do not infer successful persistence merely because checkout returned an ID.
- The frontend locks the slot with the basket/payment snapshot and reuses it
  with the same checkout idempotency key. Replay an already committed checkout
  before rechecking the lead time; a retry must not duplicate or reschedule it.
  Revalidate a genuinely uncommitted checkout at its actual acceptance time.

Example: checkout at 15:48:55 in `Asia/Singapore` offers 17:30-18:00 as the
earliest slot. Selecting 18:00-18:30 gives a 19:00 collection deadline:

```json
{
  "pickupSlotStart": "2026-10-09T10:00:00Z",
  "pickupSlotEnd": "2026-10-09T10:30:00Z",
  "pickupExpiresAt": "2026-10-09T11:00:00Z",
  "pickupTimezone": "Asia/Singapore"
}
```

The frontend uses store-local time labels. Customer Orders must not display
"Awaiting preparation" for expired/cancelled/refunded/handed-over transactions.
Legacy orders without schedule fields remain readable; do not invent a slot
or silently extend/revive an existing expired order.

### Expiry, paid overdue and payment-resolution lifecycle (revised 2026-10-10)

This policy supersedes the earlier requirement to expire paid orders.
Frontend support is implemented; the backend rules below are change requests,
not a claim that the deployed backend already implements this revised policy.
Keep `pickupExpiresAt` for wire compatibility: it is the unpaid expiry time
and the paid **collection due time**, 60 minutes after slot start. Slot creation
still fits the slot and grace inside store hours; late collection does not
imply permission to collect at a closed store.

- Only unpaid orders with no unresolved payment attempt expire automatically.
  Arrival alone does not prevent expiry. Confirmed cash and verified successful
  online payment count as paid; choosing a method, redirecting, clicking Pay,
  a browser success page or a pending mock payment do not.
- Paid orders retain their operational state/preparation status, reservations
  and lot allocations after the due time. Return `pickupTimingStatus: "OVERDUE"`
  and keep them in the active store queue and customer incomplete-order count.
  Never automatically release their inventory, expire them or fabricate refunds.
- Deadline guards must be payment-aware, under transaction/payment locks:
  reject overdue unpaid arrival/cash actions with 410, but allow paid preparation,
  fresh collection-token issuance/verification and late handover if otherwise
  eligible. Paid collection-token TTL remains short-lived and is **not capped**
  by the past due time. Terminal orders and holds remain blocked.
- Confirmed unpaid expiry releases reservations/allocations exactly once,
  records an audit event and retains transaction/payment history. Do not label
  an unknown provider outcome FAILED merely because a timer elapsed.
- Physical quality is separate from collection timing. A staff quality hold
  blocks fulfilment until review; database availability must not imply prepared
  or cut fruit is safe to resell. Replacement/disposal requires inventory audit.

#### In-flight payment protection and late success

Backend configuration in its `.env` (not a frontend `VITE_` authority):

```dotenv
PICKUP_PAYMENT_RESOLUTION_MINUTES=10
```

Bind through backend application configuration, default 10, require a positive
integer and fail startup on invalid configuration. Snapshot the resulting
absolute deadline onto each attempt; changing configuration does not alter
existing attempts. The frontend displays returned timestamps and does not
calculate payment eligibility using an environment setting.
For example, bind `checkout.pickup.payment-resolution-minutes` to
`${PICKUP_PAYMENT_RESOLUTION_MINUTES:10}` in backend application configuration.

Start protection only when an authenticated backend payment initiation creates
a genuine provider/mock attempt **before** unpaid expiry. Persist attempt ID,
start time, provider reference/session deadline and
`paymentResolutionDeadline = min(attemptStartedAt + configured minutes,
providerSessionExpiresAt)` (use the configured deadline if the provider has no
session deadline). Store this atomically with initiation/idempotency recovery.
Selection alone grants nothing; retries/repeated clicks cannot restart the
window. Keep stock reserved through the unpaid deadline and, when necessary,
through this bounded resolution window.

- Return `paymentResolutionStatus: "IN_FLIGHT"` while awaiting acknowledgement.
  Disable additional payment initiation and fulfilment actions.
- Verified SUCCESS within the window sets payment SUCCESS, resolution NONE,
  and preserves/reconfirms the existing reservation atomically. Keep the same
  transaction active; mark overdue when its collection due time passed.
- Confirmed failure/cancellation clears resolution and expires/releases the
  order if its unpaid deadline passed. Otherwise retain the normal retry policy.
- At window end, unknown is **CHECKING**, not FAILED. Reconcile using signed
  events and provider status queries; return an explicit customer/staff notice.
  Do not hold stock indefinitely merely on an unknown result: atomically record
  reservation release once at `max(pickupExpiresAt, paymentResolutionDeadline)`
  if still unresolved (never before the original unpaid deadline), retain the unresolved payment
  record and a non-terminal reviewable transaction, and block additional charges.
  This is not automatic cancellation of a captured payment.
- Late SUCCESS after release must still record payment SUCCESS and set an active
  `PAYMENT_SUCCESS` transaction with `fulfilmentHoldReason: "LATE_PAYMENT"`.
  It must not blindly become collectable. Re-reserve stock atomically, exactly
  once, before an authorized fulfilment review clears the hold. If unavailable,
  arrange replacement/rescheduling with the customer or track an authorized
  refund. Preserve original sale lines, charge, receipt and history.
- Provider-reported payment time and callback receipt time must both be audited.
  A delayed callback for payment made before the deadline still needs reservation
  checks if release already occurred. Never trust a client-supplied timestamp.
- Expiry, initiation, success, release, re-reservation, refunds and handover use
  consistent transaction/payment/inventory lock order and durable provider-event
  deduplication. Success before expiry wins; expiry/release before success enters
  fulfilment review. Duplicated/out-of-order events cannot double-charge/release/
  reserve or downgrade SUCCESS to FAILED. Return authoritative state to retries.

**Backend source changes required:** amend `PickupReservationExpiryScheduler`,
`PickupReservationExpiryService`, all deadline guards, collection/arrival token
services, queue/history projections and `CheckoutPaymentService.applySuccess`.
The currently inspected applySuccess path records SUCCESS while leaving EXPIRED
and must be replaced by the active-held late-success path above. Do not simply
change the scheduler query; operation guards and token issuance need the same
policy. Existing EXPIRED/SUCCESS orders need an audited migration/reconciliation
into active held orders, never unconditional revival with released inventory.

#### Response fields and frontend compatibility

Return on checkout, customer history, staff queue/detail and mutation results:

```json
{
  "paymentStatus": "SUCCESS",
  "pickupTimingStatus": "OVERDUE",
  "paymentResolutionStatus": "NONE",
  "paymentResolutionDeadline": null,
  "fulfilmentHoldReason": null
}
```

`pickupTimingStatus`: ON_TIME or OVERDUE (OVERDUE for active paid orders only);
`paymentResolutionStatus`: NONE, IN_FLIGHT or CHECKING;
`fulfilmentHoldReason`: null, LATE_PAYMENT or QUALITY_REVIEW.
Return the window deadline when resolving a payment, including CHECKING after it
ends. All staff mutation action flags must be false for either resolution status
or a fulfilment hold. Backend must independently enforce these guards.

Frontend now displays overdue/hold/payment-resolution notices, blocks token
actions while held/resolving and payment links while held/CHECKING or terminal.
IN_FLIGHT may open the original backend-issued payment redirect to continue
the same attempt, not create another charge. Backend continuation must recheck
provider-session eligibility and return no usable link after protection ends.
Frontend requests the server-side
`pickupTimingStatus=OVERDUE` queue filter with accurate pagination. Reject unknown
filter values rather than silently ignoring them. Include paid held orders and
CHECKING transactions in the active queue; preserve preparation filters.
Old responses lacking metadata retain existing behavior; a paid active order
past `pickupExpiresAt` receives a display-only overdue warning. Browser time
never grants eligibility. Existing EXPIRED/SUCCESS rows show a reconciliation
warning, remain non-collectable and count as unresolved in the customer badge.

#### Authorized follow-up operations

Provide store-scoped, idempotent rescheduling and hold/review contracts before
enabling those buttons. Reschedule must validate business hours, preserve old
slot/due-time audit, avoid a second sale/charge, and clear overdue only for a
valid future schedule. QUALITY_REVIEW requires actor/reason/time, blocks release,
and can be cleared only after goods review/replacement with inventory audit.
LATE_PAYMENT review must validate restored reservations before clearing.
Refunds require explicit authorized tracked outcomes, not timer-triggered success.
These operations are backend requirements, not fabricated frontend endpoints.
Until delivered, UI directs staff/customer to the store's review process.
Mock e-payment must exercise the same state machine; no real gateway is added.

#### Backend acceptance tests for revised policy

1. Cash SUCCESS and provider SUCCESS before due time remain active past it,
   including NOT_STARTED, PREPARING and READY; reservations/lots remain held.
2. Arrival-only cash expires at the original deadline; selection/redirect/browser
   acknowledgement alone never creates a paid order or a protection extension.
3. Start an attempt just before deadline and acknowledge success after deadline
   but within protection: one active paid-overdue order, no inventory release.
4. Protection uses backend `.env`, defaults to 10 minutes, respects a shorter
   provider deadline, survives refresh/restart and cannot reset via retries.
5. Failure after unpaid deadline releases once. Unknown at protection end becomes
   CHECKING, releases once with audit when both the original unpaid deadline and
   protection window have elapsed, and prevents a new charge while unresolved.
6. Success after release records payment and active LATE_PAYMENT hold. Stock
   restored exactly once permits review; unavailable stock stays held for
   authorized replacement/refund, not automatically collectable.
7. Race callback/expiry/reconciliation under locks and repeat/out-of-order events:
   no double release/reservation/charge and no SUCCESS-to-FAILED downgrade.
8. Paid-overdue READY orders issue fresh short-lived collection QR and hand over
   once; quality/late-payment/payment-checking holds block all fulfilment paths.
9. Reschedule/hold/review/refund authorization, audit and idempotency are tested;
   reschedule does not add a transaction or charge, quality review does not
   silently return cut fruit to saleable inventory.
10. Queue/filter pagination and customer history/count include active overdue,
    held and CHECKING orders; migrated EXPIRED/SUCCESS orders retain payment
    history and require stock review before release.

- Cash orders retain `ON_ARRIVAL`: scheduling does not enable advance preparation.
  Do not restart the due time on arrival or cash confirmation.
  Reserved inventory is held through the selected deadline, not just the first
  30 minutes after checkout.

### Scheduled-pickup acceptance checks

1. When hours permit, at 15:00 first slot is 16:30-17:00; at 15:00:01 it is 17:00-17:30.
2. For 22:00 closing, last slot is 21:00-21:30 with expiry at 22:00.
   For 20:00 closing it is 19:00-19:30 with expiry at 20:00. No next-day
   separate next-day opening interval is offered.
3. With 22:00 closing, at 19:30:00 checkout may select the final slot;
   at 19:30:00.001 no slots remain.
4. A browser in another timezone still uses the store-local date and times.
5. Missing schedule/timezone, starts outside the permitted operating intervals, misaligned, too-soon and
   after-cutoff requests are rejected server-side, even when submitted manually.
6. Network replay preserves the same slot/order; uncommitted late checkout is
   rejected instead of accepting a stale frontend selection.
7. Unpaid orders without an unresolved payment attempt expire at their deadline.
   Paid orders remain active/overdue with inventory retained; handed-over orders
   never expire. Payment-in-flight and late-success follow the revised policy.
   Refunds are not fabricated.
8. Concurrent expiry/handover cannot double-release reservations or goods.
9. Refreshing history and staff queue preserves the slot/deadline and hides
   arrival/collection actions for terminal orders.
10. Split shifts exclude breaks and slots whose deadline exceeds shift closing.
    Overnight intervals apply across midnight; weekday/week-boundary overlap
    is rejected. Store-local times are correct across timezone/DST transitions.
11. Store Add/Edit persistence is verified by reloading detail; customer discovery
    sees the same hours. Missing schedules block checkout, and closed days have
    no slots unless a previous day's overnight interval remains open.
12. At Friday 22:12 with Friday hours 07:30-Saturday 01:30, offer Saturday
    00:00-00:30 (expiry 01:00) and 00:30-01:00 (expiry 01:30), not Saturday's
    separate morning opening. After Friday 23:00 no eligible starts remain.
    Backend validation must not reject these accepted overnight slots simply
    because their calendar date differs from checkout.

### Persisted state and order identification

Queue, details and customer history must include `paymentMode`; pay-at-collection
records must also include:

```json
{
  "paymentMode": "PAY_AT_COUNTER",
  "preparationPolicy": "ON_ARRIVAL",
  "arrivalStatus": "EXPECTED",
  "state": "CASH_PENDING_CONFIRMATION",
  "paymentStatus": "PENDING",
  "preparationStatus": "NOT_STARTED"
}
```

Details add Boolean `actions.canRecordArrival` and `actions.canConfirmCash`
(false for online orders). Before arrival, only `canRecordArrival` is true.
After arrival and before payment, only `canConfirmCash` is true. All allocation,
preparation and handover flags remain false until paid and arrived.

The customer's transaction reference identifies which order to open, but is not
proof of ownership. Staff open the existing order in Pickup Orders, then verify
the customer's arrival token. No new cart/checkout is created.

### Arrival token: not collection authorization

`POST /api/transactions/{transactionId}/arrival-token`

Require the authenticated owning customer and an active `PAY_AT_COUNTER`,
`ON_ARRIVAL` order awaiting arrival/cash, before its scheduled expiry. Return:

```json
{
  "transactionId": "TX-1",
  "purpose": "ARRIVAL",
  "qrToken": "<short-lived signed arrival token>",
  "expiresAt": "2026-10-09T05:00:00Z"
}
```

Bind purpose, owner, store and transaction in the signed token and stored hash.
The frontend displays the arrival QR, instructions and expiry in checkout/history
before payment, without a raw arrival-token text field. It keeps the token only
in memory and removes the QR on expiry. Arrival tokens must never authorize cash
success, handover or cabinet opening; reject them at collection-token endpoints.

`POST /api/pickup-orders/{transactionId}/arrival?storeId={storeId}`

Body `{"qrToken": "<arrival token>"}` plus UUID `Idempotency-Key`.
Require authorized store staff/system user; validate purpose, signature, hash,
expiry, active order and transaction/store binding, then atomically record
`arrivalStatus: "ARRIVED"`, actor and timestamp and consume the arrival token.
Staff must confirm the customer is physically present; possession of a token
does not prove physical presence. Return full authoritative detail data.
No payment, preparation, inventory deduction or goods release occurs here.
Verification without the correct order, or opening a queue detail page alone,
must not record arrival.

### Cash receipt on the existing pickup order

`POST /api/pickup-orders/{transactionId}/confirm-cash?storeId={storeId}`

Body `{"confirmationNote": "<1-500 characters>"}` plus UUID `Idempotency-Key`.
Require `PAY_AT_COUNTER`, `ON_ARRIVAL`, `ARRIVED`, pending cash/payment and
`NOT_STARTED`. Staff check availability and collect the full displayed amount
before confirming. Revalidate availability/reservations under locks on the
server. Do not let the legacy general `confirm-cash` endpoint bypass arrival.

Return full order details with payment `SUCCESS`, transaction `PAYMENT_SUCCESS`,
preparation still `NOT_STARTED`, and arrival still `ARRIVED`. Audit receipt actor
and timestamp. Cash success must not set preparation ready or handover eligible.
Retain/reconcile inventory reservations; do not double-deduct stock in cash
confirmation, lot allocation and handover. Reserve usable inventory before cash
receipt; expire/release at `pickupExpiresAt` only while unpaid and not resolving
payment. After cash SUCCESS retain reservations even when overdue, as described
above. Do not use a checkout-relative 30-minute timeout.
Any insufficient-stock conflict must be surfaced before confirming receipt; an
operator who already received cash must follow the store's refund procedure.

Then staff allocate lots/start preparation, mark ready, and verify a **separate
collection token** from the customer before confirming handover. After payment
confirmation the customer refreshes Orders to see preparation/readiness and
request the collection QR. Arrival proof must never serve as collection proof.

Both mutations return authoritative details and obey the shared idempotency,
authorization and error contract. Network retries do not create new transactions
or repeated receipts. Persist state so refreshing the queue recovers the order;
the frontend does not simulate arrival/payment success if APIs are unavailable.

Customer checkout keeps a fixed basket/payment/slot snapshot and stable command keys
in customer-scoped session storage. A retry resumes the created cart, unacknowledged item command
or checkout instead of recreating acknowledged stages. Backend cart creation
must honor `Idempotency-Key` as well as item/checkout commands: the existing
cart-creation handler must be enhanced if it currently ignores that header.
Keys must be principal/payload-bound so a lost create response can be replayed
without another cart. Navigation/refresh in the same browser tab retains the
snapshot; verify customer Orders before retrying. Browser restart, another
device and expired server idempotency retention need separate recovery support.

### Additional acceptance checks

1. Pay-at-collection creates an unpaid original order without a payment gateway.
2. Arrival is rejected for another order/store, expired/consumed tokens or a
   collection-purpose token; arrival proof cannot release goods.
3. Preparation/allocation and cash receipt cannot occur before verified arrival.
4. Cash confirmation leaves preparation `NOT_STARTED` and cannot enable handover.
5. Refreshed queue/history recovers arrival/payment/preparation on the same order.
6. Duplicate receipts cannot charge/deduct inventory twice; both general and
   pickup-specific cash APIs enforce the mobile arrival policy.
7. Future cabinet payment requires a separate audited device/payment/unlock
   contract, verified payment and compartment assignment. No unlocking API or
   hardware control is introduced by this change.

## Shared staff API

All new endpoints use `/api` to match the current deployed frontend helpers.
Require `SYSTEM_USER` or `STAFF`, authoritative company/store authorization, and
`MOBILE_ORDER` channel. A required `storeId` query parameter identifies the UI's
selected store; it is not authorization. Compare it with the transaction's store
on **every** read and mutation. Reject customer principals and cross-store access.
Staff/device identity must come from the authenticated session, not client IDs.

### Queue

`GET /api/pickup-orders?storeId={storeId}&queueView=ACTIVE&page=0&size=20&preparationStatus=PREPARING`

- `page`: zero-based; `size`: 1-100.
- `queueView`: `ACTIVE` (default) or `RECONCILIATION`. The shared web/PDA UI
  explicitly sends this field and offers Active Pickup / Needs Reconciliation.
  Reject unknown values with 400; do not silently ignore the view.
- Optional `preparationStatus`: `NOT_STARTED`, `PREPARING`, `READY`.
- `ACTIVE`: supported non-terminal mobile pickup orders only. Exclude legacy
  raw `CASH` and `PAY_AT_COUNTER` with both arrival status and preparation policy
  absent, and orders with all pickup timestamps missing (including E_PAYMENT).
  Exclude handed-over, cancelled, expired and refunded orders. Keep
  current unpaid orders awaiting arrival/payment, paid overdue orders,
  payment IN_FLIGHT/CHECKING and fulfilment-held orders. Apply unpaid-deadline
  eligibility as described above, not arbitrary creation-date cutoffs.
- `RECONCILIATION`: non-terminal unsupported legacy or wholly unscheduled orders
  as defined above (including old E_PAYMENT records),
  plus historical `EXPIRED` orders with payment `SUCCESS` needing stock/payment
  review. Exclude ordinary unpaid expired, handed-over, cancelled and refunded
  records; retain those in authorized transaction history, not operational pickup.
  Every reconciliation detail **fulfilment** mutation flag must be false.
  Authorized review outcomes are separate capabilities as defined below.
  Preserve transaction/
  payment state; do not expire/delete/revive records simply by changing views.
- Preparation and `pickupTimingStatus=OVERDUE` filters apply to ACTIVE. UI resets
  both filters and pagination on changing view and disables them in reconciliation.
  Reject incompatible reconciliation filters with 400.
- Stable ordering: oldest creation time first, transaction ID as tie-breaker.
- Apply store/company/channel, queue view and all other filters server-side
  **before** paging, with identical predicates in result and count queries.
  Return actual `page`, `size` and matching `total`, including empty pages.

#### Backend changes for queue separation (2026-10-10)

Add `queueView` to the controller/service/repository query and matching count
query. The previous query's `pickupExpiresAt IS NULL` clause admits old unsupported
pending records and is not sufficient to classify active pickup. Reuse the
backend legacy fulfilment policy plus wholly missing schedule detection, rather
than inventing age-based expiry. The old unscheduled E_PAYMENT/PAYMENT_PENDING
case must not be left in ACTIVE simply because its payment mode is supported.
Add a reconciliation reason in summaries/details (existing legacy warning for
legacy records; explicit paid-expired review reason for EXPIRED/SUCCESS).
Keep detail-by-ID accessible with existing scope checks for historical enquiries
and URL recovery; hiding from a queue is not deletion or authorization bypass.
Audited cleanup of legacy unpaid records lacking deadlines is a separate backend
operation, not an automatic frontend action.

Frontend validates returned rows against the selected view rather than dropping
records after paging. If an old backend ignores `queueView` and returns mixed
records, UI explicitly reports unsupported filtering, without showing a false
empty queue or misleading totals. Deploy backend support alongside this UI.

Acceptance checks:
1. Mixed current/legacy records produce separate correctly paginated views;
   totals and next-page buttons reflect only the selected view.
2. Paid overdue/held and payment-checking current records remain in ACTIVE.
3. Unpaid expired and completed/cancelled/refunded records appear in neither view;
   historical EXPIRED/SUCCESS records appear in reconciliation with fulfilment
   disabled and only explicitly authorized review actions available.
4. Queue view and filter changes reset page/selected detail; another store cannot
   leak records. Detail requests remain independently store-authorized.
5. Unknown/incompatible filters fail explicitly; no arbitrary order age hides
   money owed or unresolved payments, and no cleanup creates another sale.

```json
{
  "items": [{
    "transactionId": "TX-1",
    "storeId": "STORE-1",
    "channel": "MOBILE_ORDER",
    "paymentMode": "E_PAYMENT",
    "state": "PAYMENT_SUCCESS",
    "paymentStatus": "SUCCESS",
    "preparationStatus": "NOT_STARTED",
    "amount": "18.00",
    "currency": "MYR",
    "createdAt": "2026-10-09T03:00:00Z",
    "pickupSlotStart": "2026-10-09T10:00:00Z",
    "pickupSlotEnd": "2026-10-09T10:30:00Z",
    "pickupExpiresAt": "2026-10-09T11:00:00Z",
    "pickupTimezone": "Asia/Singapore"
  }],
  "page": 0,
  "size": 20,
  "total": 1
}
```

### Audited reconciliation outcomes (added 2026-10-10)

The previous read-only queue separated records but did not resolve them.
Frontend now has a review form, required note/evidence reference, destructive
outcome acknowledgement and persisted latest-result display. It is enabled
only by backend-provided per-principal allowed outcomes. No local delete/hide
or browser-only reconciliation status is introduced.

The inspected backend currently exposes `reconcile-payment`, `review-hold`,
quality hold/reschedule and audit endpoints, but no general closure/review-note
contract. Reuse their payment/provider, inventory and hold-review internals;
do not call provider recheck and pretend it records a staff review/closure.
Implement the following additional contract; no backend source is edited here.

`POST /api/pickup-orders/{transactionId}/reconciliation?storeId={storeId}`

UUID `Idempotency-Key`, body:

```json
{
  "outcome": "CLOSE_UNPAID",
  "note": "Provider recheck confirmed no successful charge; reference ABC-123."
}
```

Allowed outcome enum:

- `RECORD_UNRESOLVED`: append an immutable review note, actor/time/evidence
  reference and retain the unresolved order. Never change payment to FAILED
  or release stock solely because the operator submitted a note. Keep current
  queue category and unresolved payment protections. This outcome must not
  masquerade as resolved or hide the record.
- `CLOSE_UNPAID`: close the original order as `CANCELLED`, not delete it.
  Backend must verify no successful/captured payment, cash receipt, pending
  refund or unresolved provider attempt, regardless of a PENDING label.
  For online attempts, query provider/mock authoritative status and coordinate
  attempt cancellation so the closed session cannot accept a new charge.
  A failed query/timeout/unknown result returns an explicit conflict with no
  closure, not an invented FAILED payment. Atomically release only genuinely
  held reservations/lots once, invalidate tokens, clear resolved payment
  protection, audit closure and preserve all history. Remove the record from
  both operational queues via state predicates, not a frontend row deletion.
  Race a late callback safely: record any genuine payment and route it to
  active fulfilment/refund review rather than discarding money.
- `RESTORE_PAID`: backend verifies actual SUCCESS, no refund/cancellation/
  handover conflict, and reconciles/restores reservations/lots atomically.
  Require authorized goods/quality review evidence, not a client assertion
  that stock exists. Clear LATE_PAYMENT/QUALITY_REVIEW only after the same
  checks as existing hold review. Preserve receipt and immutable sale lines;
  never generate another cart/sale/charge or silently mark preparation READY.
  Normalize unsupported legacy policy and arrival evidence under an audited
  migration, and require a complete valid persisted pickup schedule before
  returning the order to ACTIVE. Do not invent physical arrival for cash.
  Missing schedule/policy evidence, insufficient stock or uncertain payment
  leaves the order unresolved and returns an actionable 409. Staff can record
  RECORD_UNRESOLVED and follow authorized reschedule/replacement/refund routes.
  Success returns PAYMENT_SUCCESS or READY_FOR_HANDOVER with payment SUCCESS
  and no fulfilment hold/payment-resolution block; normal readiness/QR checks
  still apply. Paid overdue remains active even with an old valid due time.

Notes: trimmed nonblank, maximum 500 characters; do not include card details,
raw tokens or credentials. Transaction/store/principal binding, authorization
and every outcome precondition must be checked server-side at commit time.
STAFF/SYSTEM_USER role alone is not sufficient for destructive results; check
the store's reconciliation permission. Lock/recheck payment, transaction and
inventory consistently with webhook/expiry/refund/handover. Stable same-payload
retries return the original audit result; payload mismatch conflicts. Audit
records are append-only and survive closure/refresh/browser restart.

Return full authoritative order detail including this new metadata, and also
include it in GET detail (queue may include it too):

```json
{
  "reconciliation": {
    "required": true,
    "reason": "MISSING_PICKUP_SCHEDULE",
    "allowedOutcomes": ["RECORD_UNRESOLVED", "CLOSE_UNPAID"],
    "latestReview": {
      "reviewId": "rev_123",
      "outcome": "RECORD_UNRESOLVED",
      "note": "Provider outcome unknown; follow-up reference ABC-123.",
      "reviewedBy": "authorized-staff-login",
      "reviewedAt": "2026-10-10T06:00:00Z"
    }
  }
}
```

Reasons: LEGACY_ORDER, MISSING_PICKUP_SCHEDULE, PAID_EXPIRED, PAYMENT_UNRESOLVED,
FULFILMENT_REVIEW. Derive `allowedOutcomes` from current facts **and principal
permissions**; do not grant CLOSE_UNPAID when payment is confirmed or uncertain.
RESTORE_PAID requires verified successful payment and potential authorized
restoration, with full checks again at commit. An empty list means view-only.
On successful closure/restoration return `required:false`, `allowedOutcomes:[]`
and the persisted latestReview with matching outcome/note plus server audit ID,
actor and time. RECORD_UNRESOLVED returns required:true. Do not include review
capabilities among normal `actions`: legacy/terminal/held fulfilment flags stay
false and their validation remains unchanged.

Frontend explicitly warns when metadata/permissions are absent; it does not
infer permission or submit arbitrary outcome calls against old backends.
HTTP 404/405/501 reports missing backend capability. Failure/timeout disables
further review submission until authoritative refresh. Same unchanged review
reuses the session command key, without storing the raw note.
After acknowledged success refresh queue/detail and show latestReview. Closed
orders remain visible by scoped ID/history; restored orders enter ACTIVE,
unresolved notes leave the review item visible. Deploy this backend capability
to make the new form actionable; frontend mocks are not proof of runtime support.

Acceptance checks:
1. The old unscheduled E_PAYMENT order in the reported case is reconciliation,
   not active preparation; current paid-overdue/held/checking scheduled orders
   retain their operational visibility.
2. Record unresolved note and reload: same audit ID/note/actor/time remains,
   with no queue removal or payment/inventory side effects.
3. Close confirmed-unpaid legacy/unscheduled order: CANCELLED detail and audit
   persist, reservations release once and both operational queues exclude it.
4. Successful/unknown payment, provider timeout, missing permissions or wrong
   store cannot close an order; changed facts since GET are checked at commit.
5. Restore paid only with verified stock/policy/schedule/quality evidence; stock
   failure leaves order unresolved, success returns the original active sale.
6. Duplicated submissions, lost response/refresh and concurrent callback/
   closure cannot duplicate audits or lose a captured payment.
7. Invalid/mismatched audit result is not shown as success. Existing backends
   without capabilities show explicit unavailability, not a fake completion.

### Order details response

`GET /api/pickup-orders/{transactionId}?storeId={storeId}`

Return the original transaction and its sale lines, not a new cart. Allow
authorized detail reads after handover so staff can see the committed result.
The detail response contains all queue fields plus:

```json
{
  "items": [{
    "saleLineId": "LINE-1",
    "skuId": "SKU-APPLE",
    "productName": "Apple",
    "quantity": 3,
    "uom": "EA",
    "lotTracked": true,
    "allocations": [],
    "availableLots": [{
      "lotId": "LOT-1",
      "availableQuantity": 10,
      "uom": "EA",
      "expiryDate": "2026-10-12"
    }]
  }],
  "actions": {
    "canAllocateLots": true,
    "canStartPreparation": true,
    "canMarkReady": false,
    "canHandover": false,
    "canRecordArrival": false,
    "canConfirmCash": false
  }
}
```

Each line must include both arrays, even when empty. Return eligible,
non-expired lots for the exact SKU and store. `availableQuantity` must be
expressed in that sale line's UOM, including this order's existing allocation
when it can be replaced. Return consistent availability for shared lots.
The frontend supports multiple lots per sale line and checks aggregate use of a
lot across lines. The server must repeat these checks under appropriate locks,
including UOM conversions and concurrent availability.

Action flags are backend policy guidance, not authorization. Recheck them at
commit time. Payment success is **not** evidence that staff have packed the order.

### Mutations

Each mutation requires a UUID `Idempotency-Key` and returns the complete,
authoritative order-detail response. Bind idempotency to principal, store,
transaction, operation and payload. Same key/same payload replays the result;
same key/different payload is a conflict. The frontend retains the key when
retrying an unchanged failed command, including network failures.

`POST /api/pickup-orders/{transactionId}/lot-allocations?storeId={storeId}`

```json
{
  "allocations": [
    {"saleLineId": "LINE-1", "lotId": "LOT-1", "quantity": 2, "uom": "EA"},
    {"saleLineId": "LINE-1", "lotId": "LOT-2", "quantity": 1, "uom": "EA"}
  ]
}
```

Atomically replace the complete lot-allocation set for all lot-tracked lines.
Each line's total must equal its ordered quantity; require positive quantities,
no duplicate line/lot pairs, correct SKU/store/UOM and sufficient stock.
Any failure leaves the prior allocation and inventory unchanged. Reject changes
after readiness or handover. Reconcile existing reservations without double
deduction; do not repeat checkout, payment or sale posting.

`POST /api/pickup-orders/{transactionId}/preparation?storeId={storeId}`

```json
{"status": "PREPARING"}
```

Persist preparation separately from transaction/payment state:

- `NOT_STARTED -> PREPARING`: authorized staff start work on a paid order;
  `ON_ARRIVAL` orders additionally require persisted `ARRIVED` status.
- `PREPARING -> READY`: explicit staff acknowledgment that packing is complete.
  All required lot allocations must be complete and valid.
- Do not allow skipping preparation, moving backwards, or preparing terminal,
  unpaid or refunded orders. Return recomputed flags after each action.
- Audit actor, preparation timestamps and allocation changes. Determine customer
  notification delivery separately; the frontend exposes readiness on refresh
  but does not claim an SMS/WhatsApp/push notification was sent.

### Collection verification and handover

`POST /api/pickup-orders/{transactionId}/verify?storeId={storeId}`

```json
{"qrToken": "<customer collection token>"}
```

Validate token signature, expiry, stored hash, transaction binding, consumption,
store authorization, payment, preparation and fulfillment eligibility.
Do not consume the token on verification. Return:

```json
{
  "transactionId": "TX-1",
  "storeId": "STORE-1",
  "verified": true,
  "expiresAt": "2026-10-09T03:15:00Z"
}
```

The UI accepts camera QR input, pasted/typed tokens or hardware-scanner text.
Camera scanning does not itself authorize or commit a mutation.

`POST /api/pickup-orders/{transactionId}/handover?storeId={storeId}`

Body: `{"qrToken": "<same token>"}` plus `Idempotency-Key`.

Revalidate everything at commit time: a preceding verify request is not
authorization. Atomically lock/consume the collection token, commit fulfillment
and handover exactly once, record actor/device if applicable, and return order
details with `state: "HANDED_OVER"` and all mutation flags false. Reject a
different token's transaction, concurrent collection, expired/consumed tokens,
refunds and incomplete preparation. Make shared/PDA handover mutually consistent:
collection in either surface prevents a second release in the other.

Use explicit 400/401/403/404/409/410/422 responses with human-readable `message`.
Never return success-shaped empty data when an operation is unsupported.

## Existing customer and PDA endpoints: required enhancements

- Extend customer `GET /api/transactions` records with `channel`, `paymentMode`,
  `paymentStatus`, `preparationStatus` and applicable arrival/policy fields,
  retaining existing `items`/`total` pagination. Customer
  identity and ownership remain server-derived. This allows the Orders screen
  to distinguish pickup orders from counter transactions and display readiness.
  The mobile Orders icon counts incomplete transactions across all history
  pages, excluding `HANDED_OVER`, `CANCELLED`, `REFUNDED` and resolved unpaid
  `EXPIRED` orders.
  Pending/failed payment, payment-checking and paid-but-uncollected orders remain
  in the count, including legacy EXPIRED/SUCCESS rows needing reconciliation.
  The badge hides at zero and refreshes on navigation, checkout basket clearing,
  history refresh, browser focus and every 30 seconds while signed in.
  A failed count request hides the count and displays an error, not a false zero.
- Mobile customer Orders has **Current** (default) and **Past** tabs, sharing
  the same classification as the incomplete-order badge. Current includes
  non-terminal orders, paid overdue orders, and `EXPIRED` records with successful
  payment, `IN_FLIGHT`/`CHECKING` payment resolution or a fulfilment hold.
  Past includes `HANDED_OVER`, `CANCELLED`, `REFUNDED` and unpaid expired orders
  without unresolved payment/holds. A pickup deadline alone never moves an
  order to Past or authorizes collection; existing readiness/hold guards apply.
  The frontend loads all customer-owned history pages before classifying,
  sorts each view by `createdAt` descending, then displays 20 records per page.
  Switching tabs resets pagination; refresh reloads authoritative history.
  This uses the existing endpoint: no new backend filter is required. Do not
  hide terminal records from customer history or omit applicable lifecycle
  fields, since both views and the badge depend on these records. Partial or
  malformed history must show a load error rather than a misleading empty tab.
  Mobile order cards use localized customer-facing state labels and a short
  display reference; the full transaction ID remains in expandable Order
  details and is still used unchanged for all API/QR operations. Pickup times
  remain in the store timezone. Presentation changes require no backend fields.
- **Customer purchased-item listing (backend addition required):** extend each
  customer `GET /api/transactions` record with non-empty `items`, using the
  original immutable sale lines for that transaction:
  ```json
  {
    "items": [
      {
        "saleLineId": "SALE-LINE-1",
        "skuId": "SKU-1",
        "productName": "Apple",
        "quantity": 2,
        "uom": "EA",
        "productPicture": "https://images.example/apple.jpg"
      }
    ]
  }
  ```
  Reuse the corresponding shared pickup line field names. `saleLineId`,
  `productName` and `uom` must be non-blank strings; `quantity` must be a
  positive finite number (decimal strings also accepted by the frontend).
  Line IDs must be unique within the order. Return these for both Current and
  Past records, preserving line quantities and the product/unit labels from
  purchase time; do not reconstruct purchases from mutable carts or current
  catalog prices. Keep transaction `amount`/`currency` as the authoritative
  total; no frontend price calculation is performed.
  Customer records must not expose staff-only allocations, available lots or
  mutation permissions. Existing authenticated customer ownership applies.
  Optionally include `productPicture` on each line, using the same image URL/file metadata
  representation as the product catalog. Resolve it by the purchased SKU/product
  in the backend; no separate catalog fetch per order card is required.
  Return null when no image exists. Images may reflect the current catalog and
  are illustrative, not authority for purchase-time labels, quantity or price.
  Customer sessions must be able to read referenced image files under the
  existing file-access contract; do not require staff credentials or expose
  private file data. A missing/unavailable image must not suppress purchased
  lines or fail order history.
  The frontend now reuses the PDA checkout catalog-picture lookup when the
  purchased line has no image: fetch paginated `GET /api/products?active=true`
  with `pageSize=100`, match by `skuId`, and use only `productPicture`.
  Lookup is shared across visible order lines rather than one HTTP request
  per card; duplicate SKUs are looked up once within that load. Original
  purchased names, quantities, units and totals are never replaced by catalog
  data. This uses the existing customer-authorized catalog endpoint, so
  adding `productPicture` to `PurchasedItem` is an optional optimization,
  not a prerequisite for thumbnails. Missing/inactive catalog products retain
  the placeholder; lookup failures show an explicit warning while preserving
  purchased lines. Backend must continue returning SKU IDs on purchased lines
  and catalog product pictures under the existing customer read contract.
  The frontend displays a 64px thumbnail before each product name, with
  quantity/unit below the name. Missing or failed images retain a placeholder
  and all textual order details. Verify URL and file-metadata images, missing
  images and customer image access for both Current and Past orders.
  Authoritative frontend rendering is `components/common/ProductThumbnail.jsx`;
  catalog fallback is `hooks/useProductPictures.js`. Checkout product browsing,
  staff/PDA/customer cart lines, customer order history and staff/PDA pickup
  detail lines use these shared helpers. Pickup allocation/preparation/QR
  controls remain unchanged, and image lookup never grants fulfilment rights.
  Product maintenance desktop cells and mobile blocks also use the same
  renderer at 40px; its image upload/edit gallery retains existing controls.
  Do not reintroduce per-screen picture parsing or substitute catalog data for
  original purchased quantities. The existing catalog/image contracts suffice;
  this consolidation requires no backend source change.
  The frontend lists product names and quantity/unit before the order total.
  Missing, empty or malformed lines show an explicit details-unavailable
  warning, not a fabricated empty purchase. The currently inspected
  `TransactionResponse` has no `items`; `GET /api/carts/{cartId}` provides only
  SKU IDs/quantities and is not a substitute for immutable purchased lines.
  Backend acceptance: verify customer ownership, multiple purchased lines,
  decimal quantities, completed/expired orders and unchanged history after
  catalog edits, alongside the existing pagination totals.

  **Immediate backend handoff: customer order details**

  Status: frontend rendering is implemented; backend response support and
  integrated verification are pending. The items-unavailable warning is the
  expected current result, not evidence of an empty order. Backend changes are
  to be implemented by the backend team; frontend access to backend source is
  read-only.

  Implementation scope:
  1. Add `items` with the exact shape above to `TransactionResponse` and populate
     it in `TransactionService` from `SaleLineRepository` for the transaction.
     Reuse/extract the sale-line presentation used by
     `PickupOrderService.buildDetail`; do not call the staff-only detail route
     from the customer interface or duplicate inventory/fulfilment logic.
  2. Keep the existing customer identity/ownership checks. Allow customers to
     read their own purchased lines without granting staff pickup operations.
     Preserve existing response fields and `items`/`total` history pagination.
  3. The inspected `SaleLine` stores SKU, quantity and price/cost snapshots but
     does not snapshot product name or sale unit. Shared pickup detail currently
     reads those labels from the SKU/catalog. Persist purchase-time name/unit
     for new sales if history must survive catalog edits; include any required
     schema migration and checkout capture in the backend implementation.
  4. For existing orders, recover labels from authoritative purchase-time data
     if available. Do not invent historical labels or backfill current catalog
     values and describe them as purchase-time snapshots. If only current
     catalog labels are available, report that limitation and agree an explicit
     provenance/display contract with frontend before declaring historical
     details complete. Original sold quantities must always come from sale
     lines, including for the already-created order in the reported screenshot.
  5. Avoid one extra HTTP detail request per history card. Return the lines in
     the existing paginated history response, using batch retrieval where
     appropriate. Customer output must contain no stock/lot operational data.

  Backend verification and handback:
  - Test authenticated customer history with two or more products and decimal
    quantity/unit values; assert the complete item shape and original total.
  - Test both active and terminal orders, including existing legacy records;
    confirm another customer's requested history is rejected.
  - Test label preservation for newly created orders after catalog edits and
    document the explicit handling of older records without snapshots.
  - Verify the normal checkout creates sale lines that history subsequently
    returns, rather than testing only manually fabricated response objects.
  - Update the backend API schema and report test results, migration/restart
    requirements and the implemented response example. Do not share credentials.
  - After deployment/restart, frontend must check a real authorized customer
    history response and the mobile display: purchased products appear before
    the total in Current/Past, with no details-unavailable warning for valid
    lines. Existing QR eligibility and totals must remain unchanged.

  Workflow alignment follow-up is intentionally deferred. Once the user
  confirms this backend change is implemented, create a separate
  alignment-focused Markdown file for frontend/backend workflow contracts,
  confirmed gaps and verification status. Do not create that file or expand
  this immediate handoff into a general alignment audit before confirmation.
- The customer Orders screen requests a collection token only for
  `MOBILE_ORDER` transactions with `preparationStatus: "READY"` in
  `PAYMENT_SUCCESS` or `READY_FOR_HANDOVER`.
  Token issuance is still subject to backend eligibility; reject unprepared
  orders explicitly. Checkout can also show the token action for eligible
  returned states with `preparationStatus: "READY"` (if provided in checkout),
  exposes the returned e-payment redirect link, and links to Orders for later
  readiness/collection tracking.
- Return the existing token shape `{transactionId, qrToken, expiresAt}`. Tokens
  remain transient UI state, never local/session storage; expired QR/token
  displays disappear and can be renewed. Do not log raw tokens.
- Extend `POST /api/pda/scan/resolve` with `preparationStatus`. Return
  `handoverEligible: true` only when payment, preparation and allocations are
  complete for any legacy consumers. The customer pickup frontend no longer
  uses the legacy PDA verification screen: `/pda/home` redirects to the shared
  Pickup Orders workflow. Existing legacy endpoint device constraints need not
  be removed; no fabricated device identity is sent.
- Update existing PDA handover to enforce the same preparation and allocation
  invariants. Do not let the legacy endpoint bypass the new workflow.

## Acceptance checks for backend delivery

1. Cross-company/store reads and mutations, and customer calls to staff pickup
   endpoints, are denied.
2. Mixed stores/channels cannot leak into a paged queue.
3. Detail quantities come from immutable sale lines.
4. Split-lot allocations exactly cover every lot-tracked line, with safe
   conversion, atomic replacement and concurrent stock checks.
5. Paid but unprepared orders cannot be collected through either handover API.
6. Tokens for other transactions/stores, expired/consumed tokens and tokens for
   refunded orders cannot release goods.
7. Parallel handover and network retries create only one inventory commitment
   and handover event.
8. Customer history displays preparation status and issues collection tokens
   only to the authorized owner.
