# Backend Handoff: Pickup Arrival and PDA E-Payment

This document defines the backend changes required by the frontend pickup/payment flow. Frontend owns labels, payment-choice presentation, PDA payment-app invocation, callback handling, packing-due display, and order refresh. Backend owns order/payment state, signed tokens, validation, and action gating.

## Target flow

1. Customer checks out on mobile and selects either immediate e-payment or pay at store.
2. Immediate e-payment continues to use the existing hosted-payment attempt.
3. Every mobile pickup customer receives an arrival QR.
4. PDA scans arrival QR and records arrival on the existing transaction.
5. If unpaid after arrival, the customer chooses cash or e-payment.
6. Cash uses the existing staff cash-confirmation flow.
7. E-payment uses the payment app installed on the PDA:
   - FNF PDA invokes the app through an Android intent/deep link.
   - The payment app returns a confirmation to the FNF callback URL.
   - FNF PDA forwards that confirmation to FNF backend.
   - Backend validates and records the payment.
8. After payment success, both cash and e-payment follow the same packing, ready, collection-token verification, and handover flow.

Staff must never manually mark an e-payment as paid.

## 1. Arrival QR eligibility

Current backend issue logic only allows arrival tokens for unpaid `PAY_AT_COUNTER` orders with `ON_ARRIVAL` policy.

Change arrival-token issuance so every supported, non-terminal `MOBILE_ORDER` pickup transaction can issue an arrival token when arrival has not already been recorded.

Required rules:

- Customer must own the transaction.
- Store/customer/transaction claims must match the persisted order.
- Token remains signed, expiring, single-use, and backend-validated.
- Arrival token remains separate from the collection token.
- Do not allow arrival recording after terminal state or an already consumed arrival.

The arrival token proves customer/order presence only. It does not prove payment.

## 2. Pay-at-store semantics

The frontend now labels `PAY_AT_COUNTER` as **Pay at store**. To minimize migration, the backend may retain the `PAY_AT_COUNTER` enum/database value internally, but must treat it as an undecided at-store payment intent until one of these occurs:

- Staff confirms cash.
- PDA submits a valid e-payment confirmation.

After either succeeds, the payment method is final and cannot change.

If a new `PAY_AT_STORE` value is introduced instead, provide compatibility for existing `PAY_AT_COUNTER` records and update all policy/action queries accordingly.

## 3. Add PDA e-payment confirmation endpoint

Add an idempotent staff/PDA endpoint:

```http
POST /api/pickup-orders/{transactionId}/e-payment-confirmation?storeId={storeId}
Idempotency-Key: {uuid}
Content-Type: application/json

{
  "provider": "mockpay-pda",
  "providerRef": "receipt-or-provider-transaction-id",
  "paidAmount": "18.00",
  "currency": "MYR",
  "paidAt": "2026-10-11T10:00:00Z",
  "proof": "provider-signature-or-verifiable-receipt"
}
```

The frontend sends this body after the PDA payment app calls the configured callback URL.

Validation requirements:

- Authenticated staff principal and bound PDA device.
- Store and company scope.
- Existing transaction belongs to the requested store.
- Transaction is a supported mobile pickup order.
- Customer arrival has been recorded.
- Payment is still pending.
- Amount and currency match the transaction exactly.
- `paidAt` is present and syntactically valid.
- Provider and provider reference are present.
- Proof is present and validated according to the configured provider/simulator contract.
- Provider reference is unique for the provider.
- Idempotency replay returns the original result without double-recording.

State requirements on success:

- Existing transaction is updated; no cart, transaction, or sale is recreated.
- Existing payment record is converted/completed, or a new payment record is created if the backend chooses that model.
- `paymentMode` becomes `E_PAYMENT`.
- Payment status becomes `SUCCESS`.
- Transaction state becomes the existing paid pickup state used by the backend.
- `preparationStatus` remains `NOT_STARTED`.
- Arrival remains `ARRIVED`.
- The returned `PickupOrderDetail` has payment actions disabled and packing actions enabled according to stock/lot rules.

Suggested error codes:

- `PAYMENT_CONFIRMATION_INVALID`
- `PAYMENT_CONFIRMATION_MISMATCH`
- `PAYMENT_CONFIRMATION_REPLAYED`
- `PAYMENT_PROVIDER_PROOF_INVALID`
- `PAYMENT_ALREADY_COMPLETED`
- `CUSTOMER_ARRIVAL_REQUIRED`
- `PICKUP_ORDER_TERMINAL`

## 4. Expose e-payment action

Extend `PickupOrderDetail.Actions` with:

```json
{
  "canConfirmEPayment": true
}
```

Set it to true only when:

- Order is a supported mobile pickup order.
- Arrival has been recorded.
- Payment is pending.
- Order is not blocked, terminal, expired, held, or in reconciliation.
- Backend is ready to accept an e-payment confirmation for that transaction.

Set it false after cash or e-payment succeeds.

The existing `canConfirmCash` may remain true for the same unpaid arrived order, allowing the customer to choose either method. Once either succeeds, both must become false.

## 5. Cash confirmation compatibility

Keep the existing cash endpoint:

```http
POST /api/pickup-orders/{transactionId}/confirm-cash?storeId={storeId}
```

Adjust its eligibility if necessary so it works with the pay-at-store intent described above. Cash remains the only payment method staff can manually acknowledge.

## 6. Existing frontend callback contract

The payment app is invoked with a deep link configured by:

- `VITE_PDA_PAYMENT_APP_URL`, default `fnf-payment://pay`.
- `VITE_PDA_PAYMENT_CALLBACK_PATH`, default `/pda/payment-callback`.

FNF PDA sends these payment-app parameters:

- `transactionId`
- `storeId`
- `amount`
- `currency`
- `callbackUrl`

The payment app should return to `callbackUrl` with:

- `transactionId`
- `storeId`
- `status=SUCCESS`
- `paidAmount`
- `currency`
- `paidAt`
- `provider`
- `providerRef`
- `proof`

The frontend performs shape and pending-order checks only. Backend validation remains authoritative.

## 7. Simulator

Before connecting a real payment app, use a simulator provider such as `mockpay-pda`. The simulator must return the same callback fields and a deterministic test proof accepted by backend configuration. Simulator success must follow the same backend endpoint and state transition as the real payment app.

## 8. Not backend-owned

These are frontend-owned and require no backend change:

- “Pay at store” label and instructions.
- Cash/e-payment selection UI.
- Payment app deep-link invocation.
- Payment callback screen.
- Packing-due display computed from `pickupSlotStart`.
- Refresh/polling after payment confirmation.
- Packing and handover screens.

## 9. Backend tests required

Add integration tests for:

- Arrival token issued for paid e-payment, pending e-payment, and pay-at-store mobile orders.
- Arrival token remains single-use and scoped to transaction/store/customer.
- E-payment confirmation succeeds after arrival.
- Confirmation before arrival is rejected.
- Wrong amount, currency, store, transaction, provider reference, or proof is rejected.
- Duplicate provider reference is rejected.
- Idempotency replay does not double-record payment.
- Existing pending cash-intent order becomes `E_PAYMENT`/paid.
- Cash and e-payment are mutually exclusive after one succeeds.
- Payment success enables packing but not handover until ready.
- `canConfirmEPayment` is exposed only in the valid arrived/unpaid state.
