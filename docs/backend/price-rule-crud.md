# Backend Change Request — Price Rule CRUD & Publish

**Date:** 2026-10-01  
**Frontend change:** New price-rule CRUD UI (`PriceRuleList`, `PriceRuleForm` edit mode).

## Summary

The frontend now supports full price-rule lifecycle management. A user can create a price rule separately from a product, edit it, publish it, and delete it. The backend must expose the corresponding endpoints.

## Frontend UI flow

1. User navigates to **Catalog → Price Rules** (`/price-rules`).
2. The list page calls `GET /api/price-rules` and displays all rules.
3. User clicks **Add Price Rule** (`/price-rules/new`) and submits `POST /api/price-rules`.
4. New rules are saved as `DRAFT`. Drafts can be edited and published; active rules become editable after expiry.
5. For each rule, user can:
   - **Publish** → `POST /api/price-rules/{ruleId}/publish`
   - **Edit** → `PUT /api/price-rules/{ruleId}`
   - **Delete** → `DELETE /api/price-rules/{ruleId}`

## Required backend endpoints

### 1. List price rules

```http
GET /api/price-rules?status={status}&skuId={skuId}&page={page}&pageSize={pageSize}
```

Response body (paged):

```json
{
  "items": [
    {
      "ruleId": "pr-123",
      "ruleName": "Lychee Weekend Promo",
      "slogan": "Fresh lychee weekend special",
      "skuId": "sku-456",
      "productName": "Shenzhen Lychee",
      "discountType": "PERCENT",
      "discountValue": 10,
      "currency": "SGD",
      "baseUnit": "CENT",
      "roundingMode": "HALF_UP",
      "startAt": "2026-10-01T00:00:00Z",
      "endAt": "2026-10-07T23:59:59Z",
      "priority": 1,
      "status": "DRAFT"
    }
  ],
  "page": 0,
  "pageSize": 10,
  "total": 1
}
```

### 2. Create price rule

```http
POST /api/price-rules
```

Request body:

```json
{
  "ruleName": "Lychee Weekend Promo",
  "slogan": "Fresh lychee weekend special",
  "skuId": "sku-456",
  "discountType": "PERCENT",
  "discountValue": 10,
  "baseUnit": "CENT",
  "roundingMode": "HALF_UP",
  "startAt": "2026-10-01T00:00:00Z",
  "endAt": "2026-10-07T23:59:59Z",
  "priority": 1,
  "status": "DRAFT"
}
```

Response body:

```json
{
  "ruleId": "pr-123",
  "status": "DRAFT"
}
```

### 3. Update price rule

```http
PUT /api/price-rules/{ruleId}
```

Request body: same shape as create.

Response body (example when updating an expired rule):

```json
{
  "ruleId": "pr-123",
  "status": "DRAFT"
}
```

Draft rules can be edited and remain `DRAFT`. Active rules cannot be edited before their persisted `endAt`. Once an active rule passes `endAt`, it is `EXPIRED`; when the user saves edits, the frontend sends the changed fields and `"status": "DRAFT"` together in this `PUT`. Save the fields and status atomically and return `"status": "DRAFT"`. Merely opening or cancelling the edit form must not change the status.

#### Required change to the existing status update guard

The update handler must distinguish an `ACTIVE` rule still within its period from an expired rule. Keep rejecting edits to an `ACTIVE` rule whose persisted `endAt` has not passed, but allow an expired rule to transition to `DRAFT` through the existing `PUT` handler. No separate deactivate endpoint or additional approval/inactivation workflow is required.

Use the persisted record—not the request's edited `endAt`—to decide whether the rule has expired. In the same database transaction:

1. Load the rule by `ruleId` and verify it exists.
2. If its status is `ACTIVE` and persisted `endAt` has not passed, reject the update.
3. If its status is `ACTIVE` and persisted `endAt` has passed, allow the update only when the request asks for `status: "DRAFT"`.
4. If its status is `EXPIRED`, allow the update and persist it as `DRAFT`.
5. Keep edits to a `DRAFT` rule in `DRAFT`. Do not allow `PUT` to publish a rule by accepting `status: "ACTIVE"`; publishing remains separate.
6. Persist edited fields and resulting status together, then return the resulting status.

If validation fails, return the backend's normal conflict response and do not partially update either the fields or status. The frontend changes an expired rule to `DRAFT` only when the user saves edits; opening the form or cancelling it must not mutate the rule.

Example request for an expired rule:

```json
{
  "ruleName": "Lychee Weekend Promo",
  "slogan": "Fresh lychee weekend special",
  "skuId": "sku-456",
  "discountType": "PERCENT",
  "discountValue": 10,
  "baseUnit": "CENT",
  "roundingMode": "HALF_UP",
  "startAt": "2026-10-01T00:00:00Z",
  "endAt": "2026-10-07T23:59:59Z",
  "priority": 1,
  "status": "DRAFT"
}
```

### 4. Delete price rule

```http
DELETE /api/price-rules/{ruleId}
```

Response: `204 No Content` or `200 OK` with a simple confirmation body.

### 5. Publish price rule

```http
POST /api/price-rules/{ruleId}/publish
```

Accept only `DRAFT` rules whose `endAt` has not passed. On success, transition the rule to `ACTIVE`. Reject a draft whose end time has passed, and return `409 Conflict` when an active rule overlaps for the same SKU and priority.

Response body:

```json
{
  "ruleId": "pr-123",
  "status": "ACTIVE"
}
```

Publishing should validate conflicts (overlapping rules for the same SKU at the same priority) and return `409 Conflict` if any are found.

## Status values

The frontend lifecycle uses three statuses:

- `DRAFT` — rule created but not active
- `ACTIVE` — rule published, through its configured `endAt`
- `EXPIRED` — previously active rule after `endAt`; becomes `DRAFT` when edits are saved

Drafts can be edited and published until `endAt`. Active rules cannot be edited before `endAt`. The frontend derives `EXPIRED` when an `ACTIVE` record has passed `endAt`, so display and edit availability do not depend on a separate deactivation request or background job. The backend should also return `EXPIRED` for a previously published rule after `endAt`. Saving edits to an expired rule sends its edited fields and `DRAFT` status together through the existing update endpoint.

## Required backend changes

### Controller / router

Add or update the price-rule controller to expose the endpoints above. Example Spring Boot mapping:

```java
@RestController
@RequestMapping("/api/price-rules")
public class PriceRuleController {

    @GetMapping
    public PagedResponse<PriceRuleResponse> list(...) { }

    @PostMapping
    public ResponseEntity<PriceRuleResponse> create(...) { }

    @PutMapping("/{ruleId}")
    public ResponseEntity<PriceRuleResponse> update(...) { }

    @DeleteMapping("/{ruleId}")
    public ResponseEntity<Void> delete(...) { }

    @PostMapping("/{ruleId}/publish")
    public ResponseEntity<PriceRuleResponse> publish(...) { }
}
```

### DTO / response object

Ensure the response includes at minimum:

```java
public class PriceRuleResponse {
    private String ruleId;
    private String ruleName;
    private String slogan;
    private String skuId;
    private String productName;
    private String discountType;
    private BigDecimal discountValue;
    private String currency;
    private String baseUnit;       // CENT, TEN_CENT, DOLLAR
    private String roundingMode;   // UP, HALF_UP, FLOOR
    private Instant startAt;
    private Instant endAt;
    private Integer priority;
    private String status;
}
```

### Business rules

- A rule cannot overlap an existing active rule for the same `skuId` and `priority` unless the backend resolves precedence.
- Publishing a draft whose `endAt` has not passed makes it `ACTIVE` and validates conflicts.
- An active rule remains `ACTIVE` through `endAt`, then becomes `EXPIRED`.
- An expired rule transitions to `DRAFT` only when the user saves edits; opening or cancelling the edit form must not change its status.
- Active rules cannot be edited before `endAt`.
- Deleting a rule removes it from the list.
- The backend must persist `slogan`, `baseUnit`, and `roundingMode` on price rules.
- When applying a price rule, the discounted price must be rounded according to the rule's `baseUnit` and `roundingMode`:
  1. Compute the raw discounted price (`originalPrice - discount` or `originalPrice * (1 - discount/100)`).
  2. Determine the price step from `baseUnit`:
     - `CENT` → 0.01
     - `TEN_CENT` → 0.10
     - `DOLLAR` → 1.00
  3. Divide the raw price by the step, apply the selected rounding mode, then multiply back by the step.
  4. `UP` rounds away from zero, `HALF_UP` is standard 4/5 rounding, `FLOOR` rounds toward zero.
  5. The result is the final discounted price returned to POS, catalog, and any other consumer.

### OpenAPI update

Update `docs/openapi/fnf-v1.yaml` to document:

- `GET /price-rules`
- `PUT /price-rules/{ruleId}`
- `DELETE /price-rules/{ruleId}`
- `POST /price-rules/{ruleId}/publish`

Ensure all price-rule paths are under `/api` (no `/v1`).

## Acceptance criteria

- [ ] `GET /api/price-rules` returns a paged list of price rules.
- [ ] `POST /api/price-rules` creates a new rule and returns `ruleId` and `status`.
- [ ] `PUT /api/price-rules/{ruleId}` updates an existing rule.
- [ ] `DELETE /api/price-rules/{ruleId}` removes the rule.
- [ ] `POST /api/price-rules/{ruleId}/publish` publishes a `DRAFT` only through its `endAt`; conflicting activations return `409`.
- [ ] `PUT /api/price-rules/{ruleId}` keeps draft edits in `DRAFT`, rejects edits to `ACTIVE` rules before `endAt`, and transitions an expired rule to `DRAFT` atomically when saved.
- [ ] The list response includes `productName` so the frontend can display it without extra lookups.
- [ ] Request and response bodies include `slogan`, `baseUnit`, and `roundingMode`.
- [ ] Discounted-price calculation honors `baseUnit` and `roundingMode`.
- [ ] OpenAPI spec is updated to reflect the unversioned `/api` paths.
