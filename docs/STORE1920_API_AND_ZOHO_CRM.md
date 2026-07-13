# Store1920 API & Zoho CRM Integration Guide

**Document purpose:** Share with Zoho CRM / integration partners.  
**Product:** Store1920 e‑commerce platform  
**Base URL (production):** `https://store1920.com`  
**API root:** `https://store1920.com/api/...`  
**Last updated:** 2026-07-08

---

## 1. How Store1920 talks to Zoho CRM

Store1920 pushes **confirmed orders** into Zoho CRM as:

| Store1920 | Zoho CRM module | Action |
|-----------|-----------------|--------|
| Customer (guest or account) | **Contacts** | Upsert by Email (preferred) or Phone |
| Paid / confirmed order | **Deals** | Create new Deal linked to Contact |

Sync runs **automatically** after order confirmation notifications, and can also be triggered **manually** from the seller dashboard API.

### 1.1 When an order is synced

An order is synced when **all** of the following are true:

- `ZOHO_CRM_ENABLED=true`
- Zoho OAuth is configured (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`)
- Order is **not** failed / cancelled
- Order is **not** awaiting payment
- Order does **not** already have `zohoCrm.dealId`

### 1.2 Contact field mapping (Store1920 → Zoho CRM Contacts)

| Zoho CRM field | Source from Store1920 order |
|----------------|-----------------------------|
| `First_Name` | Shipping / guest / user name (first word) |
| `Last_Name` | Remaining name words (or `-`) |
| `Email` | `shippingAddress.email` → `guestEmail` → user email |
| `Phone` | Normalized UAE/local phone (`+971…`) |
| `Mailing_Street` | `shippingAddress.street` |
| `Mailing_City` | `shippingAddress.city` |
| `Mailing_State` | `shippingAddress.state` / `district` |
| `Mailing_Country` | `shippingAddress.country` (default `UAE`) |
| `Lead_Source` | Always `Store1920` |

**Upsert rules:**  
- Duplicate check field = `Email` if email exists, else `Phone`  
- Zoho API: `POST /crm/v6/Contacts/upsert`

### 1.3 Deal field mapping (Store1920 → Zoho CRM Deals)

| Zoho CRM field | Source |
|----------------|--------|
| `Deal_Name` | `Order {displayOrderNumber}` |
| `Stage` | Env `ZOHO_CRM_DEAL_STAGE` (default `Qualification`) |
| `Amount` | `order.total` (AED) |
| `Closing_Date` | Order `createdAt` (YYYY-MM-DD) |
| `Description` | Order number, payment method, status, total, line items |
| `Contact_Name` | `{ id: contactId }` from upsert |
| `Layout` | Optional – `ZOHO_CRM_DEAL_LAYOUT_ID` |

**Create:** `POST /crm/v6/Deals`

### 1.4 Example Deal description text

```
Store1920 order 12345
Payment: COD
Status: ORDER_PLACED
Total: AED 59.90
Items:
- Sup Game Box Mini Handheld Console with 400 Games x1 @ AED 59.90
```

### 1.5 Data stored back on Store1920 order

```json
{
  "zohoCrm": {
    "contactId": "6883…",
    "dealId": "6883…",
    "syncedAt": "2026-07-08T12:00:00.000Z",
    "syncStatus": "synced",
    "lastError": null
  }
}
```

Possible `syncStatus` values: `syncing` | `synced` | `failed`

---

## 2. Zoho OAuth setup (Self Client)

Store1920 uses **server-to-server OAuth** (self client + refresh token). Access tokens are refreshed automatically.

### Required scopes (CRM)

Recommended when generating the grant code:

```
ZohoCRM.modules.ALL,ZohoCRM.settings.ALL
```

(If Inventory is also used, add Inventory scopes as required by Zoho.)

### Environment variables

| Variable | Description |
|----------|-------------|
| `ZOHO_CLIENT_ID` | Self-client client ID |
| `ZOHO_CLIENT_SECRET` | Self-client secret |
| `ZOHO_REFRESH_TOKEN` | Long-lived refresh token |
| `ZOHO_REGION` | `com` \| `eu` \| `in` \| `com.au` \| `jp` \| `sa` (default `com`) |
| `ZOHO_API_DOMAIN` | Optional override (e.g. `www.zohoapis.com`) |
| `ZOHO_ACCOUNTS_DOMAIN` | Optional override |
| `ZOHO_CRM_ENABLED` | `true` to enable CRM sync |
| `ZOHO_CRM_DEAL_STAGE` | Deal stage name (default `Qualification`) |
| `ZOHO_CRM_DEAL_LAYOUT_ID` | Optional deal layout ID |

### One-time refresh token exchange

1. In Zoho API Console → Self Client → Generate Code (with CRM scopes).  
2. Within ~10 minutes, call:

```http
GET https://store1920.com/api/zoho/exchange?code={GRANT_CODE}
```

3. Copy `refresh_token` from the JSON response into `ZOHO_REFRESH_TOKEN` and restart the app.

### Connection health checks

```http
GET https://store1920.com/api/zoho/status
```

Returns whether OAuth is configured and whether an access token can be acquired (includes CRM + Inventory public flags).

```http
GET https://store1920.com/api/zoho/diagnose
```

Tries the refresh token against multiple Zoho data centers and reports the working region.

---

## 3. Store1920 Zoho API endpoints (for operators / Zoho partners)

> **Auth:** Seller/dashboard routes require Firebase ID token:  
> `Authorization: Bearer <firebase_id_token>`

### 3.1 CRM – manual sync one order

```http
POST /api/store/zoho/crm/sync
Authorization: Bearer <seller_token>
Content-Type: application/json

{
  "orderId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "force": false
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `orderId` | Yes | MongoDB order `_id` |
| `force` | No | Re-sync even if already synced |

**Success example:**

```json
{
  "success": true,
  "contactId": "…",
  "dealId": "…",
  "crm": { "enabled": true, "dealStage": "Qualification" },
  "order": { "...": "updated order document" }
}
```

**Skipped example:**

```json
{
  "skipped": true,
  "reason": "already_synced"
}
```

Skip reasons include: `zoho_crm_disabled`, `order_not_found`, `already_synced`, `order_not_eligible`, `already_synced_or_in_progress`.

### 3.2 Zoho status (seller dashboard)

```http
GET /api/store/zoho/status
Authorization: Bearer <seller_token>
```

### 3.3 Inventory – related (optional for CRM-only partners)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/store/zoho/inventory/sync` | Sync one order to Zoho Inventory sales order |
| `POST` | `/api/store/zoho/inventory/test` | Connectivity / org test |

Inventory uses Contacts/Customers + Sales Orders in **Zoho Inventory**, not CRM Deals.

---

## 4. Direction of data (important for Zoho CRM)

| Direction | Supported today? | Notes |
|-----------|------------------|-------|
| Store1920 → Zoho CRM (Contacts + Deals) | **Yes** | Automatic + manual |
| Zoho CRM → Store1920 (webhook / push) | **Not implemented** | Orders are owned by Store1920 |
| Zoho CRM reading Store1920 REST as customer master | **Not the primary design** | Prefer CRM as the destination CRM of record for deals |

If Zoho needs **inbound** sync (Zoho → website), that would be a separate project (webhooks + API key).

---

## 5. Website API overview (all domains)

Store1920 exposes ~290 Next.js App Router routes under `/api/*`.  
They fall into these groups:

### 5.1 Authentication patterns

| Pattern | Used by | Header / secret |
|---------|---------|-----------------|
| **Firebase Bearer (customer)** | Cart, profile, wishlist, tickets, addresses | `Authorization: Bearer <firebase_id_token>` |
| **Firebase Bearer (seller)** | `/api/store/*` dashboard APIs | Same header; user must own/operate a store |
| **Public (no auth)** | Catalog, shipping rates, search, public homepage data | None |
| **Webhook secrets** | Stripe, Tabby, Tamara, Waslah, Razorpay | Provider signatures / shared secrets |
| **Cron secret** | `/api/cron/*` | App-configured cron auth |

### 5.2 Storefront / customer APIs (summary)

| Area | Example routes | Methods |
|------|----------------|---------|
| Catalog | `/api/products`, `/api/products/by-slug`, `/api/products/batch`, `/api/categories`, `/api/search-products` | GET |
| Cart | `/api/cart`, `/api/cart/validate` | GET/POST |
| Checkout & shipping | `/api/shipping`, `/api/coupon`, `/api/orders` | GET/POST |
| Payments | `/api/stripe`, `/api/orders/verify-stripe`, `/api/orders/verify-tabby`, `/api/tabby/webhook`, `/api/tamara/webhook`, `/api/stripe/webhook` | POST |
| Account | `/api/profile`, `/api/address`, `/api/wishlist`, `/api/wallet` | GET/POST |
| Reviews | `/api/review`, `/api/review/can-review` | GET/POST |
| Support | `/api/tickets`, `/api/tickets/[ticketId]` | GET/POST |
| Tracking | `/api/track-order`, `/api/public/tracking-context` | GET |

### 5.3 Seller dashboard APIs (`/api/store/*`)

| Area | Example routes |
|------|----------------|
| Products | `/api/store/product`, publish/stock/FBT toggles, bulk import |
| Categories | `/api/store/categories`, import, product-stats |
| Orders | `/api/store/orders`, `/api/store/orders/[orderId]`, status, CSV, notifications |
| Customers | `/api/store/customers`, export, wallet |
| Reviews / tickets | `/api/store/reviews`, `/api/store/tickets/*` |
| Shipping / Waslah | `/api/store/waslah/ship`, `/api/store/waslah/status` |
| Reports | `/api/store/sales-report`, `/api/store/orders-by-product` |
| Zoho | `/api/store/zoho/status`, `/api/store/zoho/crm/sync`, inventory sync |
| Media | `/api/store/upload-image`, `/api/store/upload/presign` |

### 5.4 Admin APIs (`/api/admin/*`)

Store approval, home sections, admin coupons, inventory history, etc. (admin Firebase role).

### 5.5 Integrations & webhooks

| Integration | Routes |
|-------------|--------|
| **Zoho CRM / OAuth** | `/api/zoho/*`, `/api/store/zoho/*` |
| **Zoho Inventory** | `/api/store/zoho/inventory/*` |
| **Waslah courier** | `/api/store/waslah/*`, `/api/webhooks/waslah` |
| **Stripe** | `/api/stripe`, `/api/stripe/webhook` |
| **Tabby / Tamara** | `/api/tabby/webhook`, `/api/tamara/webhook` |
| **Razorpay** | `/api/razorpay/*`, `/api/webhooks/razorpay` |
| **Google Merchant** | `/api/feeds/google-merchant`, `/api/store/google-merchant/*` |
| **Meta / marketing** | `/api/store/meta-integration`, marketing expense sync |
| **WhatsApp** | `/api/store/whatsapp/send`, abandoned-cart cron |
| **Delhivery / C3Xpress** | `/api/delhivery/*`, `/api/c3xpress/*`, store send-to-delhivery |

### 5.6 Cron / background

| Route | Purpose |
|-------|---------|
| `/api/cron/abandoned-checkout-whatsapp` | Abandoned cart WhatsApp |
| `/api/cron/behavioral-triggers` | Marketing triggers |
| `/api/cron/product-ai-autofill` | Product AI jobs |

---

## 6. Orders API context (useful for CRM mapping)

Orders are created via storefront checkout (`POST /api/orders` and payment confirm flows).  
Important order fields used for Zoho CRM:

| Field | Meaning |
|-------|---------|
| `_id` | Internal Mongo id (used by sync API) |
| `shortOrderNumber` / display number | Shown in Deal name |
| `total` | Deal amount (AED) |
| `paymentMethod` | COD, Card, Tabby, Tamara, Stripe, etc. |
| `status` | Lifecycle status |
| `shippingAddress` | Name, phone, email, street, city, country |
| `guestEmail` / `guestPhone` / `guestName` | Guest checkout |
| `orderItems[]` | Line items (`name`, `quantity`, `price`, product refs) |
| `zohoCrm` | Sync state (see §1.5) |

---

## 7. Error handling (Zoho CRM sync)

| Situation | Behavior |
|-----------|----------|
| Zoho not configured | Sync skipped / HTTP 503 on manual sync |
| Missing email and phone | Contact upsert fails → `zohoCrm.syncStatus = failed` |
| Zoho API error | Error message stored in `zohoCrm.lastError` |
| Duplicate deal protection | Second sync skipped unless `force: true` |

Manual retries: call `POST /api/store/zoho/crm/sync` with `"force": true`.

---

## 8. Security notes for Zoho partners

1. **Never** put Zoho client secrets or refresh tokens in frontend code or shared Notion pages with public access.
2. Seller `Bearer` tokens are **Firebase ID tokens** (short-lived); they are not API keys for Zoho.
3. Public catalog APIs do **not** expose customer PII or Zoho IDs.
4. Prefer sharing this document + a non-production sandbox when testing CRM field layouts.

---

## 9. Checklist for Zoho CRM team

- [ ] Confirm CRM org / data center region (`com`, `eu`, `sa`, …)
- [ ] Create or approve Self Client with Contacts + Deals scopes
- [ ] Confirm Deal layout / stage names match `ZOHO_CRM_DEAL_STAGE`
- [ ] Confirm Contact duplicate rules (Email / Phone) are acceptable
- [ ] Optionally provide Deal Layout ID for `ZOHO_CRM_DEAL_LAYOUT_ID`
- [ ] Decide whether Inventory sync is also in scope (separate modules)
- [ ] Agree on Deal stage progression after Store1920 creates the Deal (handled inside Zoho, not Store1920 today)

---

## 10. Contact / ownership

| Item | Owner |
|------|--------|
| Storefront & order APIs | Store1920 engineering |
| Zoho CRM modules / stages / layouts | Zoho CRM admin |
| OAuth client & refresh token | Store1920 ops (in server env) |
| Field mapping questions | Use this document §1 |

---

## Appendix A – Minimal sequence diagram

```
Customer places order on Store1920
        │
        ▼
Payment confirmed / order eligible
        │
        ▼
Store1920 orderConfirmationNotifications
        │
        ├─► Email / WhatsApp (optional)
        │
        └─► syncOrderToZohoCrmOnce(order)
                 │
                 ├─► Zoho POST /crm/v6/Contacts/upsert
                 └─► Zoho POST /crm/v6/Deals
                          │
                          ▼
                 Store zohoCrm.contactId + dealId on Order
```

## Appendix B – Full Zoho-related route list

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/zoho/status` | Public | OAuth health |
| GET | `/api/zoho/exchange` | Public (ops only) | Grant → refresh token |
| GET | `/api/zoho/diagnose` | Public (ops only) | Region probe |
| GET | `/api/store/zoho/status` | Seller Bearer | Dashboard Zoho status |
| POST | `/api/store/zoho/crm/sync` | Seller Bearer | Manual CRM sync |
| POST | `/api/store/zoho/inventory/sync` | Seller Bearer | Manual Inventory sync |
| POST | `/api/store/zoho/inventory/test` | Seller Bearer | Inventory test |

---

*End of document.*
