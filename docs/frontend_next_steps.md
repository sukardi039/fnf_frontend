# Frontend Next Steps (Backend-Dependent)

This document captures the remaining work that requires backend implementation or coordination. The frontend slices described in the previous session are complete and the build passes.

## QR Token Issuance

- Implement `POST /api/v1/qr-tokens` for issuing backend-signed generic entity QR tokens.
  - Request body: `{ entityId: string, maxAgeMinutes?: number, noTimeScope?: boolean }`.
  - Response body: `{ qrToken: string, expiresAt?: string }`.
  - The frontend `QrGenerator` no longer performs client-side signing and depends on this endpoint.

## Customer Order History

- Implement `GET /api/v1/transactions` for listing a customer's own transactions.
  - Support query parameters: `customerId`, `status`, `page`, `size`.
  - Response body: `{ items: Transaction[], total: number }`.
  - The frontend `CustomerOrders` component calls this endpoint after a customer authenticates.

## Cookie-First Authentication

- Update `POST /api/v1/auth/customers/register` and `POST /api/v1/auth/customers/login` to issue the session as an `HttpOnly` secure cookie.
  - Stop returning `token` in the response body once cookie flow is stable.
  - The frontend transitional fallback code will then become a no-op and can be removed.
- Confirm `POST /api/v1/auth/session/refresh` rotates the refresh token and sets the new `HttpOnly` cookie.
- Confirm `POST /api/v1/auth/session/logout` clears the session cookie.

## Store and Vendor Endpoints

- Implement `GET /api/v1/stores` for listing active stores scoped to the authenticated user.
  - Support query parameters: `companyId`, `active`.
  - Response body: `{ items: Store[], total?: number }`.
- Implement `GET /api/v1/vendors` for listing active suppliers/vendors.
  - Support query parameter: `active`.
  - Response body: `{ items: Vendor[] }` or `Vendor[]`.
  - These endpoints are currently used by `PurchaseLotReceive`, `LossEventForm`, and `TvDisplayHome`.

## TV Authentication Endpoints

- Add `/api/v1/tv-auth/session`, `/api/v1/tv-auth/exchange`, and `/api/v1/tv-auth/session/{sessionCode}/status` to the OpenAPI contract if TV display access is required in production.
- TV authentication currently calls `/api/tv-auth/*` and is not covered by the v1 OpenAPI contract.

## Daily Summary Schema

- Confirm the response schema for `GET /api/v1/reports/daily-summary` matches the fields used by `TvDisplayHome`:
  - `totalSales`
  - `transactionCount`
  - `itemsSold`
  - `lossValue`
- Update either the backend schema or the frontend component if the field names differ.
