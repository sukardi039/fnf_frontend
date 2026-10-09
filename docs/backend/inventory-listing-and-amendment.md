# Backend Change Request — Inventory Listings and Conditional Amendments

## Goal

Inventory navigation should open a store-scoped list before an add form. Users can start a new purchase-lot receipt or loss event from that list. Rows may expose an **Amend** action only when the backend marks that record as eligible; the eligibility policy can be introduced or tightened later.

The frontend now links:

- Purchase lots: `GET /api/lots?storeId={storeId}`; create through the existing `POST /api/lots/receive`.
- Loss events: `GET /api/loss-events?storeId={storeId}`; create through the existing `POST /api/loss-events`.

Both list endpoints support zero-based `page`, `pageSize`, and optional case-insensitive `search` query parameters. Search should match the identifying values and human-readable names shown in the list. Responses use the standard paged shape:

```json
{
  "items": [],
  "page": 0,
  "pageSize": 100,
  "total": 0
}
```

Return the records for the requested store only. Enforce the authenticated user's store scope on the server; do not rely on the query parameter alone for authorization.

## Purchase lot list records

Each lot row should include:

```json
{
  "lotId": "lot_90123",
  "storeId": "store_1",
  "supplierId": "sup_22",
  "supplierName": "Supplier",
  "skuId": "sku_orange_whole",
  "productName": "Navel Orange",
  "supplierLotRef": "SUP-LOT-42",
  "receivedQuantity": 120,
  "availableQuantity": 116.5,
  "uom": "KG",
  "totalCost": 260,
  "receivedAt": "2026-08-07T01:20:00Z",
  "expiryDate": "2026-08-30",
  "amendable": false
}
```

Add conditional amendment support:

```http
PUT /api/lots/{lotId}
```

Use the same business fields as lot receipt, scoped to the original store. The backend must re-check amendment eligibility and authorization at update time, apply stock/cost changes consistently with inventory movements, and return the updated lot including `lotId`, `availableQuantity`, and `inventoryMovementId`. Reject disallowed changes without partially changing the lot or inventory.

## Loss event list records

Each loss row should include:

```json
{
  "lossEventId": "loss_1220",
  "storeId": "store_1",
  "lotId": "lot_90123",
  "skuId": "sku_orange_whole",
  "productName": "Navel Orange",
  "quantity": 3.5,
  "uom": "KG",
  "reasonCode": "SPOILAGE",
  "note": "Mold found during display rotation",
  "createdAt": "2026-08-07T01:30:00Z",
  "remainingQuantity": 116.5,
  "amendable": false
}
```

Add conditional amendment support:

```http
PUT /api/loss-events/{lossEventId}
```

Accept only the amended `quantity`, `reasonCode`, and `note`. Keep the original lot and SKU immutable in this operation. Recalculate the inventory effect atomically using the difference between the old and new quantities, and reject an amendment that would create invalid stock without partially updating the event or inventory. Return the updated event including `lossEventId` and `remainingQuantity`.

## Amendment eligibility

Include `amendable` as a Boolean on both list record types. The frontend displays the amend action only when it is `true`, and disables direct amendment when the flag is absent or false. The backend must always re-evaluate its amendment policy when handling a `PUT`; the response flag is presentation guidance, not authorization.

The exact policy (for example, age, approval, downstream stock use, or a manager permission) can be introduced separately. Until a policy is configured, return `false`. Never allow changing an immutable/posted record merely because a client supplied `amendable: true`.

All `PUT` operations must enforce store scope and return a useful conflict/validation response for records that are no longer eligible.
