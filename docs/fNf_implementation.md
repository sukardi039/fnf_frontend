# Fresh n Freshness Implementation Guide

## 1. Purpose

This document defines how to implement Fresh n Freshness (FnF) across the sibling repositories:

- Frontend: `fnf_frontend`
- Backend: `fnf_backend`

The product requirements and approved business rules remain authoritative in `docs/fNf_design_document.md`. The executable API contract is maintained in `docs/openapi/fnf-v1.yaml`.

Implementation proceeds API-contract first and one end-to-end feature slice at a time. Existing platform capabilities should be reused where they meet the FnF security and domain rules.

## 2. Existing Foundation

### 2.1 Frontend Components to Reuse

- React, Vite, MUI, React Router, and i18next setup.
- Administrative layout, navigation, responsive list patterns, and shared dialogs.
- Password and OTP login screens.
- Authentication context and HTTP request infrastructure, after session hardening.
- Menu visibility based on backend-provided permissions.
- Camera and QR scanning components.
- PDA login route and PDA shell.
- TV bootstrap, QR display, polling, approval, and exchange workflow.

### 2.2 Backend Components to Reuse

- Spring Boot modular deployment.
- Spring Security authentication filter structure.
- PostgreSQL, JPA, Flyway, MapStruct, and validation setup.
- System user, staff, role, user-role, login audit, mobile-login, and TV-session models.
- Password and OTP authentication services.
- Active-staff lookup by normalized mobile number.
- One-time PDA login key exchange.
- TV session state-machine foundation.

### 2.3 Foundation Constraints

The following behavior must be improved before production use:

- Frontend menus improve usability but do not authorize backend operations.
- Protected backend operations must enforce principal type, permission, company/store scope, and record access.
- Public registration may create customer identities only.
- PDA sessions must identify the real staff member and registered device; they must not impersonate a shared system user.
- Authoritative QR signing and validation belong to the backend. Browser bundles must not contain signing secrets.
- Production web sessions use secure, `HttpOnly`, `SameSite` cookies instead of persistent bearer tokens in `localStorage`.
- TV sessions receive display-only permissions rather than inheriting general user access.
- Existing backend test contexts must be repaired by reinstating or mocking `StaffService` appropriately.

## 3. Implementation Principles

1. Update OpenAPI before changing an API.
2. Use exact backend field names in the frontend; do not probe fallback field names.
3. Keep persisted business facts authoritative in the backend.
4. Refresh frontend data from the API after writes; do not synthesize successful persisted state locally.
5. Require idempotency keys for payment, handover, stock movement, loss, transformation, refund, and reconciliation writes.
6. Implement each feature as a complete vertical slice: migration, domain rules, API, frontend, tests, audit, and observability.
7. Keep the backend as one modular Spring Boot deployment and one transactional relational database for v1.
8. Do not start the next high-risk slice until the current slice passes its focused tests and contract checks.

## 4. Target Identity Model

FnF uses four distinct principal types:

| Principal     | Purpose                               | Required Scope                                         |
| ------------- | ------------------------------------- | ------------------------------------------------------ |
| `SYSTEM_USER` | Back-office web access                | User id, roles, permissions, company/store scope       |
| `STAFF`       | PDA and operational work              | `staffId`, staff role, company/store scope, `deviceId` |
| `CUSTOMER`    | Customer account and own transactions | `customerId`, own-record scope                         |
| `TV`          | Read-only display session             | Approved display/store scope only                      |

### 4.1 System User Login

- Default login uses user id and password.
- OTP login is allowed only when the system-user mobile number exactly matches an active staff mobile number.
- OTP login returns the system user's web roles and scope; it does not create a PDA staff session.

### 4.2 Staff PDA Access

1. Staff contacts the n8n-hosted WhatsApp gateway.
2. The gateway uses the sender's normalized WhatsApp mobile number as the requested mobile number.
3. n8n requests an OTP, PDA QR, or PDA link from the backend.
4. The backend confirms an exact mobile match to an active staff record before issuing a challenge.
5. The PDA exchanges the short-lived, single-use challenge.
6. The backend repeats the active-staff and mobile checks and binds the session to `staffId` and `deviceId`.
7. The resulting principal contains staff permissions and company/store scope.

### 4.3 Customer Registration

- Customer registration is separate from system-user and staff administration.
- Public input must not include role, level, permission, company, store, or staff scope.
- The backend assigns the customer role and default scope.
- Anonymous carts remain supported where approved by the product rules.

### 4.4 TV Access

- Retain the current pending, approved, exchanged, and expired bootstrap flow.
- Exchange a one-time code for a restricted `TV` principal.
- Limit the token to approved display modules and store scope.
- Do not copy the approving user's general permissions into the TV token.

## 5. QR Implementation

FnF may use reversible signed QR payloads when an identifier must be recovered.

A trusted dynamic QR payload contains only:

- identifier;
- purpose;
- issued time;
- expiry;
- nonce;
- signing key id.

Reversible means decodable, not encrypted. Authenticity comes from backend signature verification.

Backend responsibilities:

- Sign with a server-held rotating key.
- Verify signature, purpose, expiry, and nonce.
- Enforce one-time consumption where required.
- Store challenge/token material as a hash where practical.
- Maintain key rotation and verification windows.

Frontend responsibilities:

- Request a QR token from the backend.
- Render the returned token.
- Scan and submit the token unchanged.
- Display backend validation outcomes.

Static product/SKU labels may carry identifiers but never establish payment, authorization, or handover eligibility.

## 6. API Contract Strategy

The FnF API uses `/api/v1`. Existing platform endpoints may remain temporarily behind compatibility adapters while frontend consumers migrate.

Required process:

1. Add or change the operation in `docs/openapi/fnf-v1.yaml`.
2. Review request, response, errors, authorization, and idempotency.
3. Implement the backend operation.
4. Add contract and integration tests.
5. Implement or update the frontend API function using exact schema fields.
6. Add frontend interaction tests.
7. Remove compatibility endpoints only after all consumers migrate.

The shared error response must include stable `errorCode`, safe `message`, HTTP `status`, and `traceId`.

## 7. Backend Organization

Use feature modules inside the existing Spring Boot application:

```text
identity/
catalog/
inventory/
checkout/
payment/
pda/
transformation/
reporting/
tv/
shared/
```

Each module should follow the existing codebase style while separating responsibilities:

```text
controller/
application/
domain/
repository/
dto/
```

- Controllers handle transport validation and response mapping.
- Application services coordinate transactions and module interfaces.
- Domain services enforce business rules and state transitions.
- Repositories own persistence access.
- Policy components enforce principal, permission, scope, and record access.

Authorization can be centralized in application services and policy components; it does not require a unique annotation on every endpoint. No protected operation may rely only on frontend menu visibility.

## 8. Database Migration Plan

Create incremental Flyway migrations. Proposed sequence:

```text
V2__identity_hardening.sql
V3__customer_identity.sql
V4__catalog_sku_uom.sql
V5__inventory_lots_ledger.sql
V6__cart_quote_checkout.sql
V7__payments_refunds.sql
V8__pda_fulfillment_handover.sql
V9__transformation_approval.sql
V10__reporting_reconciliation.sql
V11__tv_display_scope.sql
```

Each migration must:

- define primary keys, foreign keys, unique constraints, and indexes;
- preserve existing platform data or provide an explicit conversion;
- be tested against a production-like schema snapshot;
- include forward-recovery instructions when rollback is unsafe;
- remain synchronized with the ERD and OpenAPI contract.

## 9. Frontend Organization

Retain the existing shared shell and add FnF functionality by feature:

```text
src/features/auth/
src/features/catalog/
src/features/inventory/
src/features/checkout/
src/features/payments/
src/features/pda/
src/features/transformation/
src/features/reporting/
src/features/tv/
```

Suggested feature structure:

```text
api/
components/
pages/
hooks/
schemas/
```

Frontend rules:

- List pages follow the established `PageHeader`, help dialog, filter, empty-state, and responsive grid/block-list pattern.
- Add/edit pages use the shared header and form patterns.
- Normalize API rows before rendering data grids.
- Hide unavailable controls using backend permissions, while expecting backend enforcement.
- Represent loading, empty, validation, conflict, expired-session, and dependency-unavailable states explicitly.
- After successful writes, reload authoritative data from the API.

## 10. Delivery Phases

### Phase 1: Identity and Access Hardening

Backend:

- Repair authentication test wiring, including `StaffService`.
- Introduce typed principals for system users, staff, customers, and TV displays.
- Add centralized permission and company/store-scope policies.
- Split customer registration from system-user administration.
- Replace shared-user PDA impersonation with a staff/device session.
- Add server-controlled renewable sessions and secure cookie support.
- Add backend QR issue and verify services.

Frontend:

- Retain password and OTP screens.
- Migrate production browser authentication from `localStorage` bearer tokens to secure-cookie session handling.
- Remove authoritative QR signing from active browser code.
- Update PDA login to send `deviceId` and consume the staff-scoped response.
- Preserve permission-driven menu visibility.

Exit criteria:

- Password, OTP, customer registration, PDA link/QR, and TV login flows have integration tests.
- Protected backend operations reject wrong principal types and scopes.
- No signing secret exists in a frontend bundle.
- Backend tests and frontend build/tests pass.

### Phase 2: Catalog, SKU, UOM, and Labels

- Implement product and SKU maintenance.
- Support `EA`, `KG`, `G`, `L`, and `ML` with approved precision.
- Implement explicit conversion records.
- Generate product codes through the established centralized rule.
- Issue backend-generated SKU label payloads.

### Phase 3: Inventory, Lots, Costing, and Loss

- Implement purchase lots and staff-selected lot allocation.
- Require expiry for perishable SKUs.
- Implement immutable inventory movements and weighted moving cost.
- Implement loss requests and parameter-driven manager approvals.
- Prevent negative stock under concurrent writes.

### Phase 4: Cart, Quote, and Cash Checkout

- Implement carts, items, server quotes, quote expiry, and checkout state transitions.
- Revalidate price and stock at checkout.
- Implement authorized cash confirmation.
- Record cost snapshots and audit entries atomically.

### Phase 5: Electronic Payments and Refunds

- Implement the provider-neutral payment adapter.
- Add verified webhook processing and event deduplication.
- Add daily settlement reconciliation.
- Implement manager-approved full refunds only.
- Retain production gateway selection and merchant onboarding as a release gate.

### Phase 6: PDA Fulfillment and Handover

- Implement online-only order resolution.
- Require staff-selected lot fulfillment where applicable.
- Issue and consume collection tokens.
- Enforce one successful handover per transaction.
- Block handover when live verification is unavailable.

### Phase 7: Transformation and Approval

- Implement versioned manager-configured recipes.
- Calculate yield, waste, and output cost allocation.
- Hold out-of-range batches in `PENDING_APPROVAL` without stock movement.
- Require independent manager approval before atomic posting.

### Phase 8: Reporting, Reconciliation, and TV

- Implement daily sales, loss, recovery, payment, and inventory reports.
- Implement reconciliation submission, finalization, and reopening rules.
- Upgrade TV sessions to display-only scoped principals.
- Implement approved FnF TV dashboards and controlled refresh behavior.

## 11. First Vertical Slice

The first complete working slice should prove the platform before payment complexity is introduced:

1. System-user password login.
2. System-user OTP login through active-staff mobile matching.
3. Customer-only registration.
4. Staff PDA login through n8n-issued OTP, QR, or link.
5. Principal-specific backend sessions and authorization policies.
6. Product, SKU, and UOM maintenance.
7. Receive a staff-selected purchase lot.
8. Display authoritative inventory.

This slice validates identity, authorization, device scope, migrations, API contracts, frontend patterns, auditing, and authoritative data refresh.

## 12. Validation Strategy

Run after each bounded change:

Frontend:

```powershell
npm run build
npm run test -- --run
npm run lint
```

Backend:

```powershell
mvn test
mvn -DskipTests compile
```

Also require:

- OpenAPI syntax and breaking-change checks;
- migration application against a production-like schema;
- module integration tests with a real test database;
- authorization tests for wrong role, principal type, company/store, and record owner;
- concurrency and idempotency tests for critical writes;
- end-to-end tests for each completed user journey.

## 13. Definition of Done

A feature is complete only when:

- the PRD rule and OpenAPI contract agree;
- migration and persistence constraints exist;
- backend validation, authorization, idempotency, and audit behavior are implemented;
- frontend success, loading, empty, validation, conflict, and retry states are implemented;
- authoritative state is refreshed after writes;
- unit, integration, contract, and relevant end-to-end tests pass;
- logs and metrics include a propagated `traceId`;
- documentation reflects the implemented behavior.

## 14. Immediate Next Actions

1. Repair the backend authentication tests by restoring the required `StaffService` test dependency.
2. Define typed principal/session DTOs in OpenAPI.
3. Add customer registration, session refresh/logout, PDA challenge/exchange, and TV exchange contracts.
4. Implement backend authorization policy interfaces and store-scope checks.
5. Implement backend QR issue/verify services and remove browser-authoritative signing.
6. Migrate web authentication to secure-cookie sessions.
7. Complete the first vertical slice before beginning electronic payments.
