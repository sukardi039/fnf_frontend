# Backend Change Request — Customer Product Photo Matching

**Date:** 2026-10-05  
**Frontend:** Customer mobile Browse can submit a fruit photo, show up to five ranked product suggestions, and let the customer add a selected product through the existing cart flow.

## Summary

Implement a backend image-retrieval endpoint that compares a customer-submitted photo with catalog product pictures and returns likely products. This first phase does **not** require model training. It should use a visual embedding/image-similarity service, return suggestions rather than making a purchase decision, and keep normal product search available as a fallback.

The frontend calls `POST /api/products/match-by-image`. Until this endpoint is implemented and deployed, the UI will display the backend error and customers can continue to browse or text-search the catalog.

## Request

```http
POST /api/products/match-by-image
Content-Type: multipart/form-data
```

| Form field | Required | Description |
|---|---:|---|
| `photo` | Yes | Customer image; JPEG, PNG or WebP; maximum 10 MiB |
| `storeId` | Yes | Store already identified by the frontend's GPS-first store scope (or explicitly selected manual fallback) |

The frontend does not send GPS coordinates or use the picture to identify a store. The backend must validate that the store is accessible to the caller and may restrict candidates to active products available at that store where the inventory/catalog model supports that rule.

## Response

Return no more than five candidates, ordered by descending visual similarity:

```json
{
  "matches": [
    {
      "skuId": "SKU-123",
      "productName": "Fuji Apple China",
      "productCode": "PRD-4",
      "description": "Fresh Fuji apple",
      "uom": "EA",
      "productPicture": "[{\"id\":\"file-123\",\"name\":\"fuji-apple.jpg\",\"provider\":\"google\",\"viewUrl\":\"https://...\"}]",
      "similarity": 0.84
    }
  ]
}
```

`skuId` and `productName` are required by the frontend. `productCode`, `description`, `uom`, and `productPicture` should match the product-list response shape. `similarity` is an optional ranking score in `[0, 1]`; it is **not** a calibrated probability and must not be presented as certainty. Return `{ "matches": [] }` when there is no candidate above the backend's configured minimum threshold.

Errors should use the API's normal non-2xx response format with a useful `message`. Suggested status codes: `400` for invalid/missing image or store, `413` for an oversized image, `415` for unsupported content type, `429` for rate limits, and `5xx` for unavailable matching dependencies.

## Matching implementation — first phase

1. Validate authentication/authorization, `storeId`, media type, and a hard request-size limit. Do not trust the client-provided MIME type alone; inspect/decode the file.
2. Decode and normalize the uploaded image (orientation, dimensions, and color format); reject corrupt or excessively large pixel dimensions.
3. Generate an embedding using a visual model/service suitable for image similarity.
4. Compare it with precomputed embeddings for catalog reference pictures, rank product SKUs (not raw image rows), apply a minimum-match threshold, and return at most five product records.
5. If the catalog is small, an in-memory or relationally stored embedding set may be sufficient. Use a vector index only when catalog size or latency measurements justify it.
6. Keep the uploaded customer image transient for matching. Do not persist it or add it to product reference images by default. If a later feature retains customer images, provide explicit consent, access controls, retention/deletion rules, and a review process.

## Reference-picture access and indexing

The current product API stores `productPicture` as a JSON string of file metadata (see [product-picture-field.md](./product-picture-field.md)). The matching service must be able to obtain actual image bytes from the configured storage provider. Do not expose storage credentials or private provider APIs to the browser. Support signed/authorized server-side retrieval, handle inaccessible/stale file references explicitly, and avoid repeatedly downloading every catalog image for each search.

Initially, existing product pictures can seed one or more reference embeddings per SKU. Build the index asynchronously or as a controlled backfill, and cache/reuse embeddings. If there is no usable reference image, omit that product from image matching but leave it available through normal browsing/search.

## Expanding with more actual product pictures

When staff add additional real product pictures:

1. Associate every reference image with the stable SKU and its media identifier.
2. Generate embeddings when a reference is added or changed; remove or invalidate embeddings when a picture/product is removed or deactivated.
3. Store index metadata such as `skuId`, media ID, embedding/model version, and content hash so duplicate files are not reprocessed.
4. Aggregate image-level scores to a product-level rank (for example, the best score across that SKU's references); return each SKU once.
5. Add a review workflow for curated reference images. Useful variation includes angle, lighting, ripeness, size, background, and packaging.
6. Evaluate with a held-out set of real customer-style photos, including visually similar varieties, before changing the threshold or claiming improved accuracy.

More reference photos improve coverage but do not automatically train or fine-tune a model. Consider model fine-tuning only if measured retrieval quality remains inadequate after improving reference coverage and evaluating alternative embedding models.

## Security, privacy, and operational requirements

- Require the existing customer authentication and apply rate limits/quotas.
- Enforce request and decoded-image size limits, decode in a safe image-processing library, and do not execute or trust file metadata.
- Do not log image bytes, signed URLs, or sensitive storage credentials.
- Keep store authorization server-side; the submitted `storeId` is a filter, not proof of access.
- Return only active, customer-visible product fields.
- Add metrics for latency, empty-result rate, errors, and (where customer feedback permits) confirmed suggestion rank. Do not retain the uploaded image to collect these metrics.

## Acceptance criteria

- [ ] `POST /api/products/match-by-image` accepts a supported image and `storeId`.
- [ ] Invalid, unsupported, corrupt, and oversized images are rejected with explicit errors.
- [ ] Results contain at most five unique active SKU candidates, ranked by visual similarity.
- [ ] No-match responses use an empty `matches` array; they do not return a fabricated top result.
- [ ] Matching reads product-image bytes through a secure backend storage integration.
- [ ] Customer-uploaded images are not retained by default.
- [ ] Existing product reference pictures can be indexed, and additional pictures can be added without changing SKU identity.
- [ ] Automated tests cover validation, empty matches, ranking, duplicate images for a SKU, inaccessible references, and store scoping.
- [ ] OpenAPI documents the multipart request, response, and error cases.
