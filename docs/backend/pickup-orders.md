# Backend change request: pickup order preparation and collection

## Implementation status

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
  their stored pickup slot and expiry even if hours later change. An authorized,
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

- Same-day pickup **start** only, using the selected store's IANA `timezone`,
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
  the gap. Overnight hours also admit today's early slots from yesterday's
  interval; today's late slot may end/expire tomorrow while that interval
  remains open. Show next-day dates explicitly in the UI.
- If there are no eligible starts left today, reject/disable checkout; do not
  silently offer a next-day slot start. At exactly 19:30:00 a 21:00 start is
  eligible if the store stays open through 22:00; later than that it is not.
- This applies to new customer `MOBILE_ORDER` checkout with either
  `PAY_AT_COUNTER` or `E_PAYMENT`. Staff counter checkout is unchanged.
- Customer `POST /api/checkout` includes `pickupSlotStart`, an ISO-8601 instant
  (frontend sends UTC). Resolve the store from the authenticated customer's
  cart; validate the local start date, slot alignment, store opening interval,
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

### Expiry and reservation lifecycle

- An order **not handed over** expires at or after `pickupExpiresAt`, including
  arrived, paid, preparing and ready-but-uncollected orders. This is 30 minutes
  after the slot ends, or 60 minutes after its start.
- Replace the unpaid-only reservation scheduler's eligibility for new scheduled
  orders. Under a transaction lock, exclude already handed-over/cancelled/
  expired/refunded orders, release/reconcile remaining reservations or
  allocations exactly once, audit expiry and set `state: "EXPIRED"`.
  Never mark a successful payment failed merely because collection expired.
- For paid expired orders, preserve payment/receipt history and expose the
  store's authorized refund/reconciliation workflow. Expiry alone must not
  fabricate a refund, cancel a real provider charge, or delete a cash receipt.
- Every arrival, cash, preparation, token-issuance, verification and handover
  operation must recheck the deadline under appropriate locks, even if the
  expiry scheduler has not run. At the deadline, reject collection/action with
  explicit 410 and the authoritative expired state. Handover committed before
  the deadline wins; expiry must not release inventory a second time.
- Arrival/collection QR lifetime is separate from order lifetime. Expired QR
  may be renewed only while the original order remains eligible, and its expiry
  must not exceed the order deadline.
- Cash orders retain `ON_ARRIVAL`: scheduling does not enable advance preparation.
  Do not restart/extend the collection deadline on arrival or cash confirmation.
  Reserved inventory is held through the selected deadline, not just the first
  30 minutes after checkout.

### Scheduled-pickup acceptance checks

1. When hours permit, at 15:00 first slot is 16:30-17:00; at 15:00:01 it is 17:00-17:30.
2. For 22:00 closing, last slot is 21:00-21:30 with expiry at 22:00.
   For 20:00 closing it is 19:00-19:30 with expiry at 20:00. No next-day
   slot start is offered.
3. With 22:00 closing, at 19:30:00 checkout may select the final slot;
   at 19:30:00.001 no slots remain.
4. A browser in another timezone still uses the store-local date and times.
5. Missing schedule/timezone, past-day/next-day, misaligned, too-soon and
   after-cutoff requests are rejected server-side, even when submitted manually.
6. Network replay preserves the same slot/order; uncommitted late checkout is
   rejected instead of accepting a stale frontend selection.
7. Unpaid, paid, arrived and prepared-but-uncollected orders expire at their
   deadline; handed-over orders never expire. Refunds are not fabricated.
8. Concurrent expiry/handover cannot double-release reservations or goods.
9. Refreshing history and staff queue preserves the slot/deadline and hides
   arrival/collection actions for terminal orders.
10. Split shifts exclude breaks and slots whose deadline exceeds shift closing.
    Overnight intervals apply across midnight; weekday/week-boundary overlap
    is rejected. Store-local times are correct across timezone/DST transitions.
11. Store Add/Edit persistence is verified by reloading detail; customer discovery
    sees the same hours. Missing schedules block checkout, and closed days have
    no slots unless a previous day's overnight interval remains open.

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
receipt and expire/release reservations at the scheduled `pickupExpiresAt`
deadline described above, not a checkout-relative 30-minute timeout.
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

Customer checkout keeps a fixed basket/payment snapshot and stable command keys
in memory. An in-page retry resumes the created cart, unacknowledged item command
or checkout instead of recreating acknowledged stages. Backend cart creation
must honor `Idempotency-Key` as well as item/checkout commands: the existing
cart-creation handler must be enhanced if it currently ignores that header.
Keys must be principal/payload-bound so a lost create response can be replayed
without another cart. After navigation/refresh these in-memory retry keys are
lost; verify customer Orders before submitting again. Cross-refresh customer
checkout recovery remains a separate dependency, not a guarantee of this UI.

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

`GET /api/pickup-orders?storeId={storeId}&page=0&size=20&preparationStatus=PREPARING`

- `page`: zero-based; `size`: 1-100.
- Optional `preparationStatus`: `NOT_STARTED`, `PREPARING`, `READY`.
- Return active mobile pickup orders only; exclude handed-over, cancelled,
  expired and refunded orders. Include unpaid orders with disabled preparation flags
  so staff can distinguish waiting for payment from waiting for preparation.
- Stable ordering: oldest creation time first, transaction ID as tie-breaker.
- Filter server-side **before** paging.

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
    "createdAt": "2026-10-09T03:00:00Z"
  }],
  "page": 0,
  "size": 20,
  "total": 1
}
```

### Order details

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

The UI accepts pasted/typed tokens or a hardware scanner's text output. This
change does not add camera scanning.

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
  pages, excluding `HANDED_OVER`, `CANCELLED`, `REFUNDED` and `EXPIRED`.
  Pending/failed payment and paid-but-uncollected orders remain in the count.
  The badge hides at zero and refreshes on navigation, checkout basket clearing,
  history refresh, browser focus and every 30 seconds while signed in.
  A failed count request hides the count and displays an error, not a false zero.
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
  complete. The legacy PDA Verify screen now requires `READY` as well as this
  flag and links to the existing transaction's Pickup Orders details.
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
