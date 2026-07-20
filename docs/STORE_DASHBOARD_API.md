# Store1920 Seller Dashboard API

**Audience:** Seller dashboard (`/store`), seller mobile/ops tooling  
**Base path:** `https://store1920.com/api/store/...`  
**Auth:** Firebase Bearer + store membership (`authSeller`)  
**UI language:** English only (LTR)  
**Last updated:** 2026-07-14

Shopper APIs: [MOBILE_APP_API.md](./MOBILE_APP_API.md) · Overview: [API_OVERVIEW.md](./API_OVERVIEW.md) · Index: [README.md](./README.md)

---

## 1. Authentication

```http
Authorization: Bearer <Firebase ID token>
```

Server flow:

1. `verifyIdToken` → `userId` (Firebase `uid`)
2. `authSeller(userId)` → `storeId` or `false`
   - Owner: `Store.userId === uid` and status not `rejected`
   - Team: `StoreUser` approved/pending (email fallback for invites)

### Gate

```http
GET /api/store/is-seller
```

Returns whether the caller has seller access (and related flags). Use before loading dashboard screens.

### Login context

```http
POST /api/store/login/resolve
```

Resolves store / team context after Firebase sign-in.

---

## 2. Store bootstrap & profile

| Method | Path | Purpose |
|--------|------|---------|
| POST, GET | `/api/store/create` | Create store / status |
| GET | `/api/store/data` | Dashboard data blob |
| POST, GET | `/api/store/profile/update` | Profile get/update |
| POST | `/api/store/profile/upload-image` | Logo / profile image |

---

## 3. Dashboard & analytics

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/store/dashboard` | KPIs |
| GET | `/api/store/dashboard/live` | Live pulse |
| POST | `/api/store/dashboard/insights` | Insights / AI summary |
| GET | `/api/store/sales-report` | Sales report |
| GET | `/api/store/sales-report/export` | Export report |
| GET | `/api/store/heatmap` | Click heatmap |
| GET | `/api/store/orders-by-product` | Orders by product |
| GET | `/api/store/cohorts` | Cohorts |
| GET, POST | `/api/store/rfm-scores` | RFM |
| GET, POST | `/api/store/churn-scores` | Churn |
| GET | `/api/store/customer-tracking` | Behavior tracking |
| GET | `/api/store/customer-locations` | Geo aggregates |
| GET, POST | `/api/store/balance/razorpay` | Razorpay balance |
| GET | `/api/store/balance/delhivery` | Delhivery balance |

---

## 4. Products

| Method | Path | Purpose |
|--------|------|---------|
| GET, POST, PUT, DELETE | `/api/store/product` | Product CRUD |
| POST | `/api/store/product/bulk-delete` | Bulk delete |
| PATCH | `/api/store/product/bulk-update` | Bulk patch |
| POST | `/api/store/product/bulk-import` | Import |
| POST | `/api/store/product/import-from-url` | Import from URL |
| POST | `/api/store/product/publish-toggle` | Publish on/off |
| POST | `/api/store/stock-toggle` | Stock flag |
| POST | `/api/store/fast-delivery-toggle` | Fast delivery |
| POST | `/api/store/fbt-toggle` | FBT flag |
| GET, PUT | `/api/store/products/pricing` | Pricing tools |
| PUT | `/api/store/products/free-shipping` | Free shipping flags |
| GET, POST | `/api/store/featured-products` | Featured products |
| POST | `/api/store/upload-image` | Upload media |
| POST | `/api/store/upload/presign` | Presigned upload |
| GET | `/api/store/download-image` | Download/proxy image |
| * | `/api/store/product/remirror-images/**` | Re-host images jobs |
| POST | `/api/store/product/ai-autofill` | AI fill one product |
| GET, POST | `/api/store/product/ai-autofill/bulk` | Bulk AI queue |

---

## 5. Categories & navigation

| Method | Path | Purpose |
|--------|------|---------|
| GET, POST | `/api/store/categories` | List / create |
| PUT, DELETE | `/api/store/categories/[id]` | Update / delete |
| POST | `/api/store/categories/bulk-delete` | Bulk delete |
| POST | `/api/store/categories/import` | Import |
| POST | `/api/store/categories/backfill-arabic` | Arabic backfill |
| POST | `/api/store/categories/generate-image` | Generate image |
| GET | `/api/store/categories/product-stats` | Counts |
| POST | `/api/store/upload-category-image` | Category image |
| POST | `/api/store/migration/wp-categories` | WP migration |
| * | `/api/store/category-slider/**` | Category sliders |
| GET, POST | `/api/store/category-menu` | Category menu |
| GET, POST | `/api/store/home-menu-categories` | Home menu cats |
| GET, POST | `/api/store/navbar-menu` | Navbar |
| GET | `/api/store/home-preferences` | Home prefs |

---

## 6. Coupons

Two parallel surfaces exist (dashboard may use either):

| Path family | Purpose |
|-------------|---------|
| `/api/store/coupon`, `/api/store/coupon/[code]` | Legacy coupon API |
| `/api/store/coupons`, `/api/store/coupons/[id]` | Newer CRUD by id |

---

## 7. Orders, packing, payments, returns

| Method | Path | Purpose |
|--------|------|---------|
| GET, POST | `/api/store/orders` | List / create |
| POST | `/api/store/orders/create` | Manual create |
| PUT, DELETE | `/api/store/orders/[orderId]` | Update / delete |
| POST | `/api/store/orders/update-status` | Status change |
| POST | `/api/store/orders/bulk-delete` | Bulk delete |
| POST | `/api/store/orders/csv` | CSV |
| GET | `/api/store/orders/lookup` | Lookup |
| GET | `/api/store/orders/notifications` | Notifications feed |
| GET | `/api/store/orders/[orderId]/communications` | Comms history |
| POST | `/api/store/orders/pack` | Pack |
| GET | `/api/store/orders/packed` | Packed list |
| POST | `/api/store/orders/reconcile-payments` | Bulk payment recheck |
| POST | `/api/store/orders/[orderId]/recheck-payment` | One order recheck |
| POST | `/api/store/orders/[orderId]/payment-failed-follow-up` | Failed follow-up |
| GET | `/api/store/orders/check-razorpay-settlement` | Settlement |
| POST | `/api/store/checkout` | Store checkout helper |
| GET, POST | `/api/store/return-requests` | Returns |
| PUT | `/api/store/return-requests/[id]` | Update return |
| GET, PATCH, DELETE | `/api/store/abandoned-checkout` | Abandoned carts |

**Payment stuck:** use `recheck-payment` after provider captured/authorized. Also backed by cron — see [WEBHOOKS_AND_CRONS.md](./WEBHOOKS_AND_CRONS.md).

Order field reference: [ORDER_DETAILS.md](./ORDER_DETAILS.md).

---

## 8. Shipping (Waslah / Delhivery / proxy)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/store/waslah/status` | Status |
| POST | `/api/store/waslah/ship` | Create shipment |
| POST | `/api/store/waslah/sync-status` | Sync status |
| POST | `/api/store/waslah/print-receipts` | Labels |
| POST | `/api/store/waslah/mark-label-printed` | Mark printed |
| GET | `/api/store/waslah/senders` | Senders |
| GET | `/api/store/waslah/services` | Services |
| POST | `/api/store/send-to-delhivery` | Delhivery push |
| POST | `/api/store/schedule-pickup` | Pickup |
| POST | `/api/store/courior/proxy` | Courier proxy |

Public shipping rates & payment limits (also used at checkout):

```http
GET /api/shipping?storeId={storeId}
```

Seller may update settings via shipping settings routes used by `/store/shipping` UI (Bearer seller). See project shipping skill for COD/Card/Tabby/Tamara max amounts.

---

## 9. Inventory

| Method | Path | Purpose |
|--------|------|---------|
| GET, PATCH | `/api/store/inventory` | Stock list / patch |
| GET | `/api/store/inventory/export` | Export |
| GET | `/api/store/inventory/history` | History |
| GET | `/api/store/inventory/history/export` | History export |

Warehouse-facing variants: [warehouse-inventory-api.md](./warehouse-inventory-api.md), [warehouse-order-packing-api.md](./warehouse-order-packing-api.md).

---

## 10. Customers & wallet

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/store/customers` | List |
| GET | `/api/store/customers/[customerId]` | Detail |
| GET | `/api/store/customers/export` | Export |
| GET | `/api/store/registered-customers` | Account customers |
| POST | `/api/store/customers/wallet` | Credit |
| POST | `/api/store/customers/wallet/deduct` | Debit |

---

## 11. Marketing & giveaways

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/store/marketing-analytics` | Analytics |
| * | `/api/store/marketing-expenses/**` | Spend + Meta sync |
| * | `/api/store/meta-integration` | Meta Ads connection |
| * | `/api/store/giveaways/**` | Free gift campaigns |
| GET, POST | `/api/store/spin-campaign` | Spin wheel |
| * | `/api/store/behavioral-triggers` | Triggers |
| * | `/api/store/google-merchant/**` | Merchant Center |
| * | `/api/store/tabby/webhooks` | Register Tabby webhooks |

---

## 12. WhatsApp, email, notifications

| Method | Path | Purpose |
|--------|------|---------|
| POST, GET | `/api/store/whatsapp/send` | Send / config probe |
| POST | `/api/store/send-notification` | Notify |
| GET, PUT | `/api/store/notification-settings` | Prefs |
| GET, POST | `/api/store/email-templates` | Templates |
| GET | `/api/store/email-history` | History |

External WhatsApp contract: [WHATSAPP_INTEGRATION_API.md](./WHATSAPP_INTEGRATION_API.md).

---

## 13. Reviews & tickets

| Method | Path | Purpose |
|--------|------|---------|
| GET, POST, DELETE | `/api/store/reviews` | Manage reviews |
| POST | `/api/store/reviews/approve` | Approve |
| GET | `/api/store/tickets` | Tickets |
| GET | `/api/store/tickets/[ticketId]` | Detail |
| POST | `/api/store/tickets/[ticketId]/reply` | Reply |
| PATCH | `/api/store/tickets/[ticketId]/status` | Status |

---

## 14. AI

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/store/ai` | Assistant |
| GET | `/api/store/ai/status` | Status |
| GET | `/api/store/ai/queue` | Queue |
| * | `/api/store/product/ai-autofill/**` | Product autofill |

Bulk autofill is also processed by `GET /api/cron/product-ai-autofill`.

---

## 15. Appearance & explore

| Method | Path | Purpose |
|--------|------|---------|
| GET, POST | `/api/store/appearance/sections` | Auth sections |
| GET | `/api/store/appearance/sections/public` | **Public** read |
| GET, PUT | `/api/store/mobile-features` | Mobile app design (home banners) — UI `/store/mobile-features` |
| * | `/api/store/featured-sections/**` | Featured sections |
| GET, PUT | `/api/store/preferences/top-bar` | Top bar |
| GET, PUT | `/api/store/preferences/shop-showcase` | Showcase |
| GET, PUT | `/api/store/signin-modal` | Sign-in modal |
| * | `/api/store/explore-interests/**` | Explore interests (+ public) |

---

## 16. Settings, sitemap, DB import

| Method | Path | Purpose |
|--------|------|---------|
| GET, PUT | `/api/store/settings` | Settings |
| POST | `/api/store/settings/update` | Update |
| GET, POST | `/api/store/sitemap-settings` | Sitemap (auth) |
| GET | `/api/store/sitemap-settings/public` | **Public** |
| * | `/api/store/settings/database-import/**` | Import dump / run / media URL rewrite |

Zoho:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/store/zoho/status` | Status |
| POST | `/api/store/zoho/crm/sync` | CRM sync |
| POST | `/api/store/zoho/inventory/sync` | Inventory sync |
| GET | `/api/store/zoho/inventory/test` | Connectivity |

Partner mapping: [STORE1920_API_AND_ZOHO_CRM.md](./STORE1920_API_AND_ZOHO_CRM.md).

---

## 17. Team users & trash

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/store/users` | List team |
| POST | `/api/store/users/create` | Create |
| POST | `/api/store/users/invite` | Invite |
| POST | `/api/store/users/accept` | Accept |
| POST | `/api/store/users/approve` | Approve |
| POST | `/api/store/users/delete` | Remove |
| POST | `/api/store/users/make-admin` | Promote |
| POST | `/api/store/users/update-permissions` | Permissions |
| GET | `/api/store/trash` | Trash list |
| POST | `/api/store/trash/restore` | Restore |
| POST | `/api/store/trash/permanent` | Hard delete |

---

## 18. Public exceptions under `/api/store`

These do **not** require seller auth (safe for storefront):

- `GET /api/store/appearance/sections/public`
- `GET /api/store/explore-interests/public`
- `GET /api/store/sitemap-settings/public`

Everything else assumes Bearer + `authSeller`.

---

## 19. Approx size

~160 route handlers under `app/api/store/**`. This document groups them by product area; individual request bodies mirror the `/store` UI forms. When integrating a new seller screen, start from the matching group above and inspect the route file under `app/api/store/...`.
