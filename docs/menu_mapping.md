# Menu Mapping: Web, PDA, and Customer Mobile

This document maps the implemented frontend features to their menu sections across the three user surfaces.

## GPS-first store selection

The dashboard, inventory operations, staff checkout, customer cart checkout,
transformation batches/approvals, customer browse/cart, daily summary,
reconciliation and TV dashboard identify their store from a fresh device GPS
location before loading store data.
The nearest active store with valid latitude/longitude is selected only when it
is within **100 metres**, inclusive. The authenticated session's assigned store
and a single-store list are not used as automatic substitutes for GPS.

When GPS is unsupported, denied, times out, is unavailable, or finds no store
within that radius, the screen explains the failure and offers manual selection
from the active store list. Failed store-list requests are shown explicitly with
a retry; they cannot be replaced by an arbitrary typed store ID. Retrying GPS
clears the selection. Changing stores remounts the operational screen so previous
store data, forms, carts and results are not reused for another store.

Store administration remains unrestricted. Company scoping and backend
authorization still apply; GPS selection is not an authorization mechanism.
Browsers require location permission and a secure context (HTTPS or localhost).
Customer photo matching uses this selected store as a catalog filter; the fruit
photo never determines the store.

## Shared checkout browse/cart experience

Customer mobile, web checkout and PDA checkout use the shared `ProductCatalog`
and `CheckoutCartItems` components for product search, product cards, quantity
selection, cart review, quantity changes and item removal. Order creation still
uses the channel selected or allowed by that surface: customer mobile sends
`MOBILE_ORDER`, web checkout can select a channel, and PDA checkout is fixed to
`STAFF_ASSISTED`. Store scope, customer identity, payment choices, server quotes
and backend authorization remain specific to each flow.

The shared product catalog also supports photo matching on customer mobile and
staff checkout browse surfaces. Selecting or taking a photo submits it
immediately using the GPS-selected (or manually selected fallback) store.
Matches remain suggestions; adding a product to the cart is still an explicit
customer/staff action. Tapping the camera icon again clears the photo and returns
to the full catalog.

## Web System (`/src/layouts/components/Sidebar.jsx`)

### Base Setup & Administration

| Function        | Route              | Menu Section   |
| --------------- | ------------------ | -------------- |
| Company         | `/company`         | Base Setup     |
| Roles           | `/role`            | Base Setup     |
| Users           | `/user`            | Base Admin     |
| User Roles      | `/userRole`        | Base Admin     |
| Login Enquiry   | `/userlogin`       | Base Admin     |
| Forced Password | `/forced-password` | Base Admin     |
| QR Generator    | `/qr-generator`    | Base Admin     |
| Parameters      | `/parameter`       | Base Admin     |
| WA Simulator    | `/wa-simulator`    | Business Admin |

### Catalog

| Function                      | Route                      | Menu Section |
| ----------------------------- | -------------------------- | ------------ |
| Product Catalog (create/edit) | `/product`                 | Catalog      |
| Price Rules (list)            | `/price-rules`             | Catalog      |
| Price Rules (create/edit)     | `/price-rules/new`         | Catalog      |
| Price Rules (edit)            | `/price-rules/edit`        | Catalog      |
| SKU Label Generator           | `/catalog/labels`          | Catalog      |
| UOM List                      | `/catalog/uoms`            | Catalog      |
| UOM Conversions               | `/catalog/uom-conversions` | Catalog      |

### Inventory

| Function             | Route                        | Menu Section |
| -------------------- | ---------------------------- | ------------ |
| Purchase Lots        | `/inventory/lots`            | Inventory    |
| Receive Purchase Lot | `/inventory/lots/new`        | Inventory    |
| Loss Events          | `/inventory/loss-events`     | Inventory    |
| Record Loss          | `/inventory/loss-events/new` | Inventory    |
| Stock View           | `/inventory/stock-view`      | Inventory    |

### Checkout

| Function        | Route                       | Menu Section |
| --------------- | --------------------------- | ------------ |
| Staff Checkout  | `/checkout/staff`           | Checkout     |
| Pickup Orders   | `/checkout/pickup`          | Checkout     |
| Refund Request  | `/checkout/refunds/new`     | Checkout     |
| Refund Approval | `/checkout/refunds/approve` | Checkout     |

Web/PDA Staff Checkout keeps cash and pay-at-counter transactions pending until
staff explicitly confirm receipt of the full amount with a confirmation note.
The existing cash-confirmation endpoint updates the original transaction;
confirmation is not physical handover. Failed unchanged confirmation retries
reuse the idempotency key, and a pending transaction cannot be cleared using
Start New Order. Pending state is not yet recoverable through this screen after
refresh/navigation.

### Transformation

| Function                  | Route                          | Menu Section   |
| ------------------------- | ------------------------------ | -------------- |
| Recipes (list + activate) | `/transformations/recipes`     | Transformation |
| New Recipe                | `/transformations/recipes/new` | Transformation |
| Batches (list)            | `/transformations/batches`     | Transformation |
| Run Batch                 | `/transformations/batches/new` | Transformation |
| Approvals                 | `/transformations/approvals`   | Transformation |

### Reporting

| Function       | Route                     | Menu Section |
| -------------- | ------------------------- | ------------ |
| Daily Summary  | `/reports/daily-summary`  | Reporting    |
| Reconciliation | `/reports/reconciliation` | Reporting    |

## PDA (`/src/components/pda/PdaLayout.jsx`)

Bottom navigation tabs:

| Tab    | Route       | Function                                                                       |
| ------ | ----------- | ------------------------------------------------------------------------------ |
| Verify | `/pda/home` | Scan collection token, resolve transaction, confirm handover (`PdaAccessHome`) |
| Checkout | `/pda/checkout` | GPS-scoped staff-assisted checkout: create a cart, add products, review the authoritative quote, and initiate payment |
| Pickup | `/pda/pickup` | Store-scoped existing mobile orders: review lines, allocate lots, prepare, verify collection token and hand over |
| Me     | `/pda/me`   | PDA user profile and logout (`PdaMe`)                                          |

The PDA login gate is at `/pda/login` and is not part of the bottom navigation.

Pickup Orders operates on the original customer transaction; it does not create
a second cart or charge. Staff Checkout offers only counter-sale channels
(`STAFF_ASSISTED` and `STORE_SELF_SELECT`). Pickup preparation is tracked
separately from payment. Both web and PDA pickup screens require the new backend
contract in [pickup-orders.md](backend/pickup-orders.md); this frontend change
does not implement those backend endpoints.

## Customer Mobile (`/src/components/customer/CustomerShell.jsx`)

Bottom navigation tabs:

| Tab     | Route        | Function                                                  |
| ------- | ------------ | --------------------------------------------------------- |
| Browse  | `/m/browse`  | Browse active products and add to cart (`CustomerBrowse`) |
| Cart    | `/m/cart`    | Review cart, adjust quantities, checkout (`CustomerCart`) |
| Orders  | `/m/orders`  | List own transaction history (`CustomerOrders`)           |
| Profile | `/m/profile` | Customer profile info and logout (`CustomerProfile`)      |

The customer auth gate is at `/m/auth` (`CustomerAuth`) and is not part of the bottom navigation. The root `/m` redirects to `/m/browse`.

The Cart icon shows a badge with the number of selected item lines (distinct
SKUs), not the total quantity. It updates when lines are added or removed,
restores with the saved cart, and is hidden when the cart is empty.

Customer Orders supports refresh/pagination, displays returned preparation
status, and requests a short-lived collection QR/token for eligible mobile
orders. The backend must supply `channel` and `preparationStatus` in customer
history. Tokens are not persisted and disappear on expiry. The checkout result
also exposes a returned payment link and collection-token action when eligible.

Customer Cart uses the fixed `MOBILE_ORDER` channel and offers pay cash at
collection (`PAY_AT_COUNTER`, default) or online payment (`E_PAYMENT`, currently
labelled development-only because the gateway is mocked). It shows the
pickup store, preparation/collection instructions and authoritative checkout
state. Pending payment is not displayed as payment success. Server-side policy
enforcement and payment continuation remain backend dependencies documented in
[pickup-orders.md](backend/pickup-orders.md).

Pay-at-collection orders are prepared only after customer arrival and cash
receipt, not in advance. Customers present a short-lived arrival QR; staff open
the existing order, verify arrival, confirm cash receipt, prepare, and finally
verify a separate collection QR for handover. Arrival tokens do not prove payment
or authorize goods release. These new arrival/pickup-cash endpoints require
backend implementation. Future cooled-cabinet preparation/payment/unlocking is
not implemented.

## TV Display

TV display is not part of the web sidebar, PDA, or customer mobile navigation. It uses a standalone route under `/tv`:

| Function     | Route          | Entry Point                                   |
| ------------ | -------------- | --------------------------------------------- |
| TV Bootstrap | `/tv/start`    | `TvBootstrap` (session creation and approval) |
| TV Dashboard | `/tv/projects` | `TvDisplayHome` (daily summary dashboard)     |
