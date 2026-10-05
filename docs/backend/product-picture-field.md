# Backend Change Request — Add `productPicture` Field to Product

**Date:** 2026-09-30  
**Frontend change:**
- `src/components/catalog/ProductForm.jsx` and `src/components/catalog/ProductCatalog.jsx` now support product picture upload/display.
- `src/components/catalog/PriceRuleForm.jsx` now uses the same catalog service as the rest of the module and supports editing existing rules.
- `src/components/catalog/PriceRuleList.jsx` is a new price-rule CRUD list page.
- All frontend API versioning (`/api/v1/...`) has been removed from the active codebase.

## Summary

The product catalog form now sends and expects a `productPicture` field. The backend must accept, persist, and return this field on the `/api/products` endpoints.

All frontend calls are now unversioned under `/api`.

## Frontend payload contract

The form POSTs/PUTs to `/api/products` with the following payload shape:

```json
{
  "productName": "Shenzhen Lychee",
  "format": "WHOLE",
  "uom": "KG",
  "price": 8,
  "currency": "SGD",
  "active": true,
  "productPicture": "[{\"id\":\"1a2b3c...\",\"name\":\"lychee.jpg\",\"mimeType\":\"image/jpeg\",\"url\":\"...\",\"viewUrl\":\"...\",\"provider\":\"google\",\"uploadedAt\":\"2026-09-30T...\"}]"
}
```

`productPicture` is a **JSON string** containing an array of file metadata objects. It may also be `null` when no picture is attached.

### File metadata object shape

```json
{
  "id": "google-drive-file-id",
  "name": "filename.jpg",
  "mimeType": "image/jpeg",
  "uploadedAt": "2026-09-30T12:00:00Z",
  "url": "https://...",
  "viewUrl": "https://...",
  "provider": "google"
}
```

## Required backend changes

### 1. Database

Add a column to the product table:

```sql
ALTER TABLE product
ADD COLUMN product_picture TEXT NULL;
```

Use `TEXT` (or equivalent large string type) because the value is a JSON array string and may be long.

### 2. Entity / JPA entity

Add the field to the product entity:

```java
@Column(name = "product_picture", length = 4000)
private String productPicture;
```

### 3. DTO / request-response object

Add to the product DTO used by `/api/products`:

```java
private String productPicture;
```

Ensure the field is:
- Accepted on `POST /api/products`
- Accepted on `PUT /api/products/{id}`
- Returned on `GET /api/products` (list)
- Returned on `GET /api/products/{id}`

### 4. Service / mapper

Ensure the field is mapped between entity and DTO in both directions.

### 5. Validation

No special validation is required. Treat the field as optional free-form text.

## Endpoint consistency note

The frontend catalog module now uses these paths exclusively:

- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/{id}`
- `GET /api/product-formats`
- `POST /api/product-formats`
- `PUT /api/product-formats/{formatCode}`
- `POST /api/labels`
- `GET /api/labels/{labelRef}/download`
- `POST /api/price-rules`
- `GET /api/price-rules`
- `PUT /api/price-rules/{ruleId}`
- `DELETE /api/price-rules/{ruleId}`
- `POST /api/price-rules/{ruleId}/publish`

The legacy `/api/v1/products`, `/api/v1/price-rules`, and `/api/products` paths are no longer called by the catalog module.

## OpenAPI update

Update `docs/openapi/fnf-v1.yaml` to include `productPicture` in the `Product` schema and ensure all catalog endpoints above are documented under the `/api` base path:

```yaml
productPicture:
  type: string
  nullable: true
  description: JSON string array of file metadata for product images
  example: '[{"id":"abc123","name":"apple.jpg","mimeType":"image/jpeg","url":"...","viewUrl":"...","provider":"google","uploadedAt":"2026-09-30T12:00:00Z"}]'
```

## Acceptance criteria

- [ ] `GET /api/products` returns `productPicture` for each product when present.
- [ ] `POST /api/products` accepts and persists `productPicture`.
- [ ] `PUT /api/products/{id}` accepts and updates `productPicture`.
- [ ] Setting `productPicture` to `null` clears the stored value.
- [ ] `POST /api/price-rules` is available and accepts the price-rule payload.
- [ ] `GET /api/price-rules` returns a paged list of price rules with `ruleId`, `ruleName`, `skuId`, `productName`, `discountType`, `discountValue`, `currency`, `startAt`, `endAt`, `priority`, and `status`.
- [ ] `PUT /api/price-rules/{ruleId}` updates an existing price rule.
- [ ] `DELETE /api/price-rules/{ruleId}` deletes a price rule.
- [ ] `POST /api/price-rules/{ruleId}/publish` publishes a draft price rule.
- [ ] OpenAPI spec is updated to document the `productPicture` field and the catalog endpoint paths (all under `/api`, no `/v1`).
