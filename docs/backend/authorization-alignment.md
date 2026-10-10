# Frontend/backend authorization alignment

Status: proposed contract and source-verified baseline, not an implemented
policy engine or live integration certification.

Scope: WEB staff administration, PDA checkout/pickup, and MOBILE customer
ordering. Backend source is read-only for frontend work. Backend implements its
own changes from this document; frontend implementation follows the agreed
contract. TV, external integrations and other modules require a separate pass
before any system-wide migration.

Related contracts: [Pickup orders](pickup-orders.md),
[Product pictures](product-picture-field.md), and
[Product photo matching](product-photo-matching.md).

## 1. Objective and boundaries

Make legitimate role/action/resource pairings explicit and consistently
enforced. Do not weaken ownership or store checks to make a screen work.

Keep five separate concerns:

1. Authentication: validate the credential and derive the principal/session.
2. Session interface: select WEB/PDA/MOBILE credentials and expiry policy.
3. Authorization: decide whether that principal can act on that resource.
4. Business eligibility: validate payment, stock, preparation, holds and state.
5. Response contract: return the fields the authorized interface needs.

An interface header is not a role, permission or ownership claim. Frontend
visibility, local profile data, request customer/store IDs and QR possession
alone never confer authorization. A policy change cannot create missing API
data or override fulfilment constraints.

## 2. Current source baseline

Evidence paths are relative to the respective repositories.

| Concern | Frontend evidence | Backend evidence | Finding |
|---|---|---|---|
| Interface/credentials | `src/helpers/axios_helper.js`, `src/helpers/session_helper.js` | `config/JwtAuthFilter.java`, `identity/SessionCookieSupport.java` | Requests send `X-Session-Interface`; backend selects scoped cookies and validates session/interface binding |
| Role checks | Shared helpers select credential scope | `security/PrincipalAccessPolicy.java` | Backend services currently hard-code permitted principal types |
| Store scope | Pickup helper supplies `storeId` | `inventory/InventoryStoreScope.java` | Backend compares company and assigned store; client store selection is not sufficient |
| Customer history | `helpers/customer_cart_helper.js` | `checkout/TransactionService.java` | Customer identity is principal-derived; a different requested customer ID is rejected |
| Purchased lines | `components/customer/CustomerOrders.jsx` | `checkout/PurchasedItem.java`, `checkout/SaleLinePresentation.java` | Item response now exists; legacy label provenance/warnings must not be discarded |
| Thumbnails | `components/common/ProductThumbnail.jsx`, `hooks/useProductPictures.js` | Existing customer-authorized catalog reads | SKU catalog fallback supports thumbnails without a new order-image endpoint |
| Staff pickup | `helpers/pickup_helper.js` | `checkout/PickupOrderService.java` | Staff/system scope and business guards are separate from customer history |

Backend Java paths above are under
`src/main/java/com/hcteol/jwt/backend/`.

Source compatibility is not runtime verification. No real session/money/stock
operations were performed for this alignment baseline.

## 3. Initial operation matrix

These are existing routes, not instructions to invent duplicate APIs.
Map HTTP method and route to an internal stable operation ID.

| Operation ID | Existing route | Intended caller | Required resource scope/eligibility |
|---|---|---|---|
| `stores.read` | GET `/api/stores`, `/api/stores/{id}` | CUSTOMER, STAFF, SYSTEM_USER | Customer active-store visibility; staff/company scope |
| `catalog.read` | GET `/api/products`, `/api/products/{id}` | CUSTOMER, STAFF, SYSTEM_USER | Existing customer catalog visibility; staff/company scope |
| `catalog.matchPhoto` | POST `/api/products/match-by-image` | CUSTOMER, STAFF, SYSTEM_USER | Selected active/authorized store and existing rate limit |
| `catalog.maintain` | POST/PUT products and SKUs | SYSTEM_USER | Authorized company; preserve existing maintenance rules |
| `carts.read` | GET `/api/carts/{id}` | CUSTOMER, STAFF, SYSTEM_USER | Customer owns cart; staff/company scope |
| `carts.create` | POST `/api/carts` | CUSTOMER, STAFF, SYSTEM_USER | Server derives customer identity where applicable; permitted channel/store |
| `carts.edit` | POST/PUT/DELETE cart items | CUSTOMER, STAFF, SYSTEM_USER | Same scope plus cart state and valid quantity |
| `checkout.submit` | POST `/api/checkout` | CUSTOMER, STAFF, SYSTEM_USER | Cart scope; quote, stock, channel, schedule and idempotency guards |
| `orders.customerHistory` | GET `/api/transactions` for CUSTOMER | CUSTOMER | Principal-owned orders including terminal records |
| `orders.staffHistory` | GET `/api/transactions` for staff/system | STAFF, SYSTEM_USER | Company/store scope also when filtering by customer |
| `orders.arrivalToken` | POST `/api/transactions/{id}/arrival-token` | CUSTOMER | Own order; eligible unpaid on-arrival pickup |
| `orders.collectionToken` | POST `/api/transactions/{id}/collection-token` | CUSTOMER; existing staff/system support retained | Own order or authorized staff scope; paid, prepared, allocated, unblocked |
| `orders.continuePayment` | GET `/api/transactions/{id}/payment-continuation` | CUSTOMER | Own order; resume original eligible payment attempt only |
| `pickup.read` | GET `/api/pickup-orders`, `/api/pickup-orders/{id}` | STAFF, SYSTEM_USER | Authorized store and transaction/store match |
| `pickup.arrival` | POST pickup `/{id}/arrival` | STAFF, SYSTEM_USER | Authorized store; ARRIVAL proof and physical presence workflow |
| `pickup.confirmCash` | POST pickup `/{id}/confirm-cash` | STAFF, SYSTEM_USER | Authorized store; arrival/payment/state checks; idempotent receipt |
| `pickup.allocate` | POST pickup `/{id}/lot-allocations` | STAFF, SYSTEM_USER | Authorized store; valid original lines, stock and allocation rules |
| `pickup.prepare` | POST pickup `/{id}/preparation` | STAFF, SYSTEM_USER | Authorized store; permitted preparation transition |
| `pickup.verify` | POST pickup `/{id}/verify` | STAFF, SYSTEM_USER | Authorized store; collection proof and current eligibility |
| `pickup.handover` | POST pickup `/{id}/handover` | STAFF, SYSTEM_USER | Revalidate/consume collection proof, allocations and state atomically |
| `pickup.reconcile` | POST pickup `/{id}/reconciliation` | Explicitly granted STAFF/SYSTEM_USER | Store reconciliation grant plus outcome/evidence/business checks |

Maintain separate response projections: customer purchased lines must not
include staff allocations, available stock or mutation permissions.
Do not broaden the staff pickup detail endpoint simply to serve customers.

## 4. Confirmed alignment work items

### A1. PDA logout route/request mismatch

Frontend `components/pda/PdaMe.jsx` and `PdaLogin.jsx` call
POST `/api/mobile-logins/logout` with a null body. Current
`controllers/MobileLoginController.java` exposes request/verify/login, not this
logout route; `config/SecurityConfig.java` denies other `/api/mobile-logins/**`
routes. Local cleanup/navigation therefore does not prove server revocation.

Existing backend POST `/api/auth/pda/session/logout` requires
`PdaSessionRefreshRequest.refreshToken` in the body. Frontend cannot assume a
refresh cookie is JavaScript-readable.

Backend action: agree a cookie-based PDA logout contract compatible with the
current cookie-based login, ideally extending the existing PDA logout route
to read its scoped HttpOnly refresh cookie. Define bearer-only transitional
logout explicitly if required; do not require fabricated device identities or
tokens that frontend never receives.

Frontend action after contract agreement: replace both incorrect calls with
one shared PDA logout helper. Always clear PDA local state and preserve the
agreed normal logout destination `/login`; report unsuccessful server logout
without claiming revocation succeeded.

### A2. MOBILE and WEB logout are currently local-only

`CustomerShell.handleLogout` calls `clearCustomerSession` and navigates.
`context/authContext.jsx` logout clears local web state; `TopBar.jsx` invokes
it. No frontend call to the existing MOBILE
`/api/auth/session/logout` or WEB `/api/auth/web/session/logout` was found.
HttpOnly cookies cannot be cleared by localStorage/sessionStorage cleanup.

Backend action: confirm existing routes revoke the affected session and clear
only its cookies, including already-expired/missing-session behavior.
Frontend action: use scoped server logout helpers, then local cleanup in
`finally`. Advance that interface's session generation so late responses
cannot reinstall credentials. Preserve other interfaces' state.

### A3. Authentication endpoint/error classification is duplicated

Frontend `session_helper.js` keeps an endpoint exception regex; backend
`JwtAuthFilter` and `SecurityConfig` keep their own lists. Current frontend
exceptions include the nonexistent PDA logout route but not all actual
interface logout/refresh routes.

Action: align route definitions and tests. Authentication failure during login
must remain a local form error; explicit terminal session signals on protected
requests close the affected interface. Do not turn every 403 or expired order/
QR into a session logout. An unsupported route must not be treated as successful.

### A4. Legacy purchased-item warnings are not shown by frontend

Backend now returns `itemsWarning`, per-line `detailsWarning`,
`productNameSource` and `uomSource`. Frontend displays valid name/quantity/unit
but does not consume these warnings/provenance fields. Existing valid legacy
labels can therefore appear purchase-time authoritative when backend says
they are current-catalog labels.

Action: agree localized source/warning codes and render their meaning without
changing original quantities/totals. Keep missing-detail errors distinct from
missing-thumbnail placeholders. This is a response alignment gap, not a
principal permission defect.

These findings are source-confirmed, not a count of all system defects.
Implement/retest them before claiming authorization consolidation is complete.

## 5. Proposed backend policy configuration

Use a version-controlled JSON resource loaded and validated at startup.
This example is a proposed format, not a current backend implementation:

```json
{
  "policyVersion": "1",
  "operations": {
    "orders.customerHistory": {
      "grants": [
        {
          "principal": "CUSTOMER",
          "scope": "OWN_CUSTOMER_RECORDS",
          "projection": "CUSTOMER_ORDER"
        }
      ]
    },
    "pickup.confirmCash": {
      "grants": [
        {
          "principal": "STAFF",
          "scope": "AUTHORIZED_COMPANY_STORE",
          "projection": "STAFF_PICKUP"
        },
        {
          "principal": "SYSTEM_USER",
          "scope": "AUTHORIZED_COMPANY_STORE",
          "projection": "STAFF_PICKUP"
        }
      ]
    }
  }
}
```

Backend implementation requirements:

- Map routes/methods to registered operation IDs internally. Never accept an
  operation ID/role/scope from the caller as authority.
- Validate policy version, duplicate keys, principal/scope/projection enums,
  unknown fields and registered operations. Malformed policy fails startup;
  missing grants/unknown operations deny by default.
- Implement named scopes as typed server code, reading authenticated identity
  and authoritative resource/company/store records. JSON contains no executable
  expressions, SQL or arbitrary class names.
- Apply list scope before pagination/count, and detail scope before exposing
  data. Route/body store mismatches remain errors.
- Reuse shared evaluators; retain independent state/payment/stock/idempotency
  checks in business services and revalidate at mutation commit time.
- Keep challenge creation, session validation, provider callbacks and public
  routes separate from ordinary authenticated business grants.
- Do not add live policy editing or hot reload in the initial rollout.
  Deploy policy and code together with rollback to the previous release.
- Do not remove existing guards until parity tests cover their replacement.
  Conflicting old/new policies must deny/report, not union permissions.
- Keep response JSON schemas in the API contract. Projection names reference
  allowlisted serializers; they do not manufacture missing response fields.

Frontend must not load this policy and infer authorization. It may consume
backend-computed contextual capabilities, such as existing pickup `actions`
and reconciliation `allowedOutcomes`. These are UX hints; the mutation
endpoint always checks again. No new capabilities endpoint is required for
the initial alignment pass.

## 6. Session/error contract to preserve

- WEB: 1800 seconds; PDA: 43200 seconds; MOBILE: 2592000 seconds. These are
  backend absolute validity limits, not frontend timers or business permissions.
- Every protected frontend request selects the intended session interface.
  Keep WEB/PDA/MOBILE scoped cookies and transitional bearer storage separate.
- Validate login challenge target at creation/exchange; WEB OTP must not
  create/reuse a PDA one-use challenge accidentally.
- Use `errorCode` and human-readable `message`; frontend currently also accepts
  legacy `code` for terminal session signals.
- Protected 401 or explicit `SESSION_EXPIRED`, `SESSION_REVOKED`,
  `INVALID_SESSION` ends only the affected interface, without refresh/replay.
- Ordinary authorization denial is 403; missing resource 404; state conflict
  409; expired pickup/token 410; invalid business input 400/422 as appropriate.
  These must not masquerade as session expiry.
- Terminal expiry destinations remain WEB `/login`, PDA `/pda/login`,
  MOBILE `/m/auth`; normal PDA logout remains `/login`.
- A successful server logout must revoke/clear server credentials. Local
  cleanup is still required on network failure but cannot certify revocation.

## 7. Rollout and acceptance

1. Backend reviews A1-A4 and confirms endpoint/cookie/warning contracts here.
2. Frontend implements the corresponding shared helpers/response handling.
3. Test existing routes before policy migration; capture allowed/denied
   behavior using isolated fixtures rather than production orders/stock.
4. Migrate history/read authorization first; preserve output/ownership parity.
5. Migrate staff mutations incrementally with business guards unchanged.
6. Run integrated browser/API checks with consented test accounts, then record
   results below. E-payment remains mock-only.

Required tests:

- Real customer session: stores/catalog, cart/checkout, original purchased
  lines, thumbnail lookup, Current/Past and badge consistency.
- Customer owns order: arrival/collection tokens as eligible; another customer
  cannot read/act on it. Customer cannot invoke staff mutations.
- Staff on WEB/PDA: authorized store read/arrival/cash/allocation/preparation/
  handover; another store is denied; reconciliation requires its explicit grant.
- List filtering by customer never removes staff company/store constraints.
- Logout each interface: server revocation/cookie clearing, immediate login
  navigation, other sessions preserved, late responses ignored.
- Protected expired/revoked session: no request replay; ordinary 403/410/
  network failure does not terminate a valid session.
- Double QR exchange, payment/command retries and concurrent handover remain
  safe; ARRIVAL QR never authorizes collection.
- Paid overdue remains active/eligible subject to quality/stock holds; unpaid
  expiry and unknown payment outcomes retain the agreed lifecycle semantics.
- Policy parsing fails for malformed/unregistered rules; unknown operations
  deny; valid policy preserves existing role/scope behavior.

| Deliverable | Current status | Evidence/next gate |
|---|---|---|
| Customer purchased items | Backend source and frontend renderer exist | User screenshot shows product lines; provenance handling pending |
| Shared product thumbnails | Frontend consolidation complete | 91 focused frontend tests passed previously; session/file runtime parity still requires verification |
| Authorization operation matrix | Documented here | Backend review required |
| Logout alignment | A1/A2 source gaps confirmed | Agree and implement scoped server logout contract |
| Error/provenance alignment | A3/A4 source gaps confirmed | Contract and regression tests required |
| JSON policy evaluator | Proposed only | Backend implementation/parity tests required |
| End-to-end authorization certification | Not complete | Consented integrated test runs required |

Do not replace these statuses with "complete" based only on documentation,
mocked UI tests, or a source inspection. Backend handback should include changed
contracts, policy/schema version, isolated test results and restart/migration
requirements, never credentials or sensitive test-account information.
