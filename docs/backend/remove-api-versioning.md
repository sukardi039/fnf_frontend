# Backend Change Request — Remove `/api/v1` API Versioning

**Date:** 2026-09-30  
**Frontend change:** All live frontend API calls have been changed from `/api/v1/...` to `/api/...`.

## Summary

The frontend no longer uses URL-path versioning. Every endpoint previously called under `/api/v1` must now be available under `/api`. The backend must expose the same controllers/handlers at the unversioned paths.

## Scope of change

The following endpoint groups were using `/api/v1` and must be moved to `/api`:

| Domain | Old path prefix | New path prefix |
|---|---|---|
| Auth refresh | `/api/v1/auth/session/refresh` | `/api/auth/session/refresh` |
| Customer auth | `/api/v1/auth/customers/*` | `/api/auth/customers/*` |
| Products | `/api/v1/products` | `/api/products` |
| Product formats | `/api/v1/product-formats` | `/api/product-formats` |
| Labels | `/api/v1/labels` | `/api/labels` |
| Price rules | `/api/v1/price-rules` | `/api/price-rules` |
| Carts / checkout | `/api/v1/carts`, `/api/v1/checkout`, `/api/v1/transactions` | `/api/carts`, `/api/checkout`, `/api/transactions` |
| Refunds | `/api/v1/refunds` | `/api/refunds` |
| Vendors | `/api/v1/vendors` | `/api/vendors` |
| Stores | `/api/v1/stores` | `/api/stores` |
| Inventory snapshots | `/api/v1/inventory/snapshots` | `/api/inventory/snapshots` |
| Lots | `/api/v1/lots/receive` | `/api/lots/receive` |
| Loss events | `/api/v1/loss-events` | `/api/loss-events` |
| Transformations | `/api/v1/transformations` | `/api/transformations` |
| Transformation recipes | `/api/v1/transformation-recipes` | `/api/transformation-recipes` |
| UOMs | `/api/v1/uoms` | `/api/uoms` |
| UOM conversions | `/api/v1/uom-conversions` | `/api/uom-conversions` |
| QR tokens | `/api/v1/qr-tokens` | `/api/qr-tokens` |
| QR label resolve | `/api/v1/labels/resolve-qr` | `/api/labels/resolve-qr` |
| Reports | `/api/v1/reports/daily-summary` | `/api/reports/daily-summary` |
| Reconciliations | `/api/v1/reconciliations` | `/api/reconciliations` |
| PDA scan | `/api/v1/pda/scan/resolve` | `/api/pda/scan/resolve` |
| PDA handover | `/api/v1/pda/transactions/{id}/handover` | `/api/pda/transactions/{id}/handover` |

## Required backend changes

### 1. Controller / router path mapping

Remove the `/v1` segment from all controller class-level or method-level mappings.

Example for Spring Boot:

```java
// Before
@RestController
@RequestMapping("/api/v1/products")
public class ProductController { }

// After
@RestController
@RequestMapping("/api/products")
public class ProductController { }
```

Apply the same change to every controller listed in the scope table.

### 2. Security / CORS configuration

Update any security filter, CORS allowed-origins, or path-based authorization rules that reference `/api/v1/**` to use `/api/**`.

```java
// Before
.requestMatchers("/api/v1/**").permitAll()

// After
.requestMatchers("/api/**").permitAll()
```

### 3. Reverse proxy / gateway / nginx

If an API gateway or nginx routes `/api/v1` to backend services, update the routes to `/api`.

```nginx
# Before
location /api/v1/ {
    proxy_pass http://backend/;
}

# After
location /api/ {
    proxy_pass http://backend/;
}
```

### 4. OpenAPI spec

Update `docs/openapi/fnf-v1.yaml` so all server URLs and endpoint paths use `/api` instead of `/api/v1`.

```yaml
servers:
  - url: http://localhost:8080/api
    description: Local API

paths:
  /products:
    get:
      ...
```

### 5. Tests

Update backend integration/unit tests that assert on `/api/v1/...` request paths.

## Rollout considerations

- The frontend build is already updated; deploy backend changes before or together with the next frontend release.
- If mobile/PDA clients or other consumers still use `/api/v1`, either update them too or keep both paths during a transition period.
- This change does not affect archive/legacy frontend code in `archive/non_base/`, which uses older unversioned paths like `/api/products`.

## Acceptance criteria

- [ ] Every endpoint previously under `/api/v1` responds correctly under `/api`.
- [ ] No live frontend call receives a 404 due to a missing `/api` path.
- [ ] Security, gateway, and OpenAPI configurations are updated to match.
- [ ] Backend tests pass with the new paths.
