# Menu Mapping: Web, PDA, and Customer Mobile

This document maps the implemented frontend features to their menu sections across the three user surfaces.

## GPS-first store selection

The dashboard, inventory operations, staff checkout, customer cart checkout,
transformation batches/approvals, daily summary, reconciliation and TV dashboard
identify their store from a fresh device GPS location before loading store data.
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

## Shared checkout browse/cart experience

Customer mobile, web checkout and PDA checkout use the shared `ProductCatalog`
and `CheckoutCartItems` components for product search, product cards, quantity
selection, cart review, quantity changes and item removal. Order creation still
uses the channel selected or allowed by that surface: customer mobile sends
`MOBILE_ORDER`, web checkout can select a channel, and PDA checkout is fixed to
`STAFF_ASSISTED`. Store scope, customer identity, payment choices, server quotes
and backend authorization remain specific to each flow.

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
| Purchase Lot Receive | `/inventory/lots/receive`    | Inventory    |
| Loss Event           | `/inventory/loss-events/new` | Inventory    |
| Stock View           | `/inventory/stock-view`      | Inventory    |

### Checkout

| Function        | Route                       | Menu Section |
| --------------- | --------------------------- | ------------ |
| Staff Checkout  | `/checkout/staff`           | Checkout     |
| Refund Request  | `/checkout/refunds/new`     | Checkout     |
| Refund Approval | `/checkout/refunds/approve` | Checkout     |

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
| Me     | `/pda/me`   | PDA user profile and logout (`PdaMe`)                                          |

The PDA login gate is at `/pda/login` and is not part of the bottom navigation.

## Customer Mobile (`/src/components/customer/CustomerShell.jsx`)

Bottom navigation tabs:

| Tab     | Route        | Function                                                  |
| ------- | ------------ | --------------------------------------------------------- |
| Browse  | `/m/browse`  | Browse active products and add to cart (`CustomerBrowse`) |
| Cart    | `/m/cart`    | Review cart, adjust quantities, checkout (`CustomerCart`) |
| Orders  | `/m/orders`  | List own transaction history (`CustomerOrders`)           |
| Profile | `/m/profile` | Customer profile info and logout (`CustomerProfile`)      |

The customer auth gate is at `/m/auth` (`CustomerAuth`) and is not part of the bottom navigation. The root `/m` redirects to `/m/browse`.

## TV Display

TV display is not part of the web sidebar, PDA, or customer mobile navigation. It uses a standalone route under `/tv`:

| Function     | Route          | Entry Point                                   |
| ------------ | -------------- | --------------------------------------------- |
| TV Bootstrap | `/tv/start`    | `TvBootstrap` (session creation and approval) |
| TV Dashboard | `/tv/projects` | `TvDisplayHome` (daily summary dashboard)     |
