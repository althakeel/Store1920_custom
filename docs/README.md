# Store1920 API Documentation

**Base URL:** `https://store1920.com`  
**API root:** `https://store1920.com/api/...`  
**Last updated:** 2026-07-14

This folder is the **full API documentation set** — from public storefront / mobile app through seller dashboard, platform admin, payments, webhooks, crons, warehouse, and integrations.

---

## Start here

| # | Document | Who it’s for | Coverage |
|---|----------|--------------|----------|
| 0 | **[API_OVERVIEW.md](./API_OVERVIEW.md)** | Everyone | Architecture, auth modes, systems map, how pieces connect |
| 1 | **[MOBILE_APP_API.md](./MOBILE_APP_API.md)** | Customer mobile / web shopper | Catalog, cart, checkout, COD/Stripe/Tabby/Tamara, wishlist, track order (~90 routes) |
| 1b | **[MOBILE_HOME_PAGE_APIS.md](./MOBILE_HOME_PAGE_APIS.md)** | Mobile home screen | Same APIs as website homepage + mobile banners API |
| 2 | **[STORE_DASHBOARD_API.md](./STORE_DASHBOARD_API.md)** | Seller `/store` dashboard apps | Products, orders, shipping, **Mobile Features**, marketing, team (~160+ routes) |
| 3 | **[ADMIN_API.md](./ADMIN_API.md)** | Platform admins | Store approval, home merchandising, global coupons (~19 routes) |
| 4 | **[WEBHOOKS_AND_CRONS.md](./WEBHOOKS_AND_CRONS.md)** | Backend / DevOps | Stripe, Tabby, Tamara, Razorpay, Waslah, crons |
| 5 | **[ORDER_DETAILS.md](./ORDER_DETAILS.md)** | All builders | Order document fields & statuses |
| 6 | **[WHATSAPP_INTEGRATION_API.md](./WHATSAPP_INTEGRATION_API.md)** | Messaging integrations | WhatsApp abandoned cart & order messages |
| 7 | **[STORE1920_API_AND_ZOHO_CRM.md](./STORE1920_API_AND_ZOHO_CRM.md)** | CRM partners | Zoho CRM contact/deal sync |
| 8 | **[warehouse-order-packing-api.md](./warehouse-order-packing-api.md)** | Warehouse Android app | Order packing APIs |
| 9 | **[warehouse-inventory-api.md](./warehouse-inventory-api.md)** | Warehouse app | Inventory APIs |
| 10 | **[warehouse-android-firebase-setup.md](./warehouse-android-firebase-setup.md)** | Warehouse app setup | Firebase config for warehouse |
| 11 | **[GOOGLE_MERCHANT_CENTER_COMPLIANCE.md](./GOOGLE_MERCHANT_CENTER_COMPLIANCE.md)** | Merchant Center / Ads ops | Misrepresentation checklist + appeal prep |

---

## Route volume (approx.)

| Surface | Prefix | ~Count |
|---------|--------|--------|
| Shopper (mobile + public site) | `/api/*` (non-store/admin) | ~90 |
| Seller dashboard | `/api/store/*` | ~160 |
| Platform admin | `/api/admin/*` | ~19 |
| Crons | `/api/cron/*` | 6 |
| Webhooks / ops | Stripe, Tabby, Tamara, Waslah, warehouse, courier | ~30 |

**Total:** ~305 `app/api/**/route.js` handlers.

---

## Auth at a glance

| Audience | Auth |
|----------|------|
| Guest shopper | No token; `isGuest` + `guestInfo` / `anonymousId` |
| Logged-in shopper | `Authorization: Bearer <Firebase ID token>` |
| Seller | Same Bearer + `authSeller(uid)` → `storeId` |
| Platform admin | Same Bearer + email allowlist (`ADMIN_EMAIL` / `NEXT_PUBLIC_ADMIN_EMAIL`) |
| Crons | `Authorization: Bearer <CRON_SECRET>` |
| Payment webhooks | Provider signatures / secrets (never from mobile apps) |

---

## Recommended reading order

1. [API_OVERVIEW.md](./API_OVERVIEW.md) — mental model  
2. Pick your audience doc (Mobile / Store / Admin / Warehouse)  
3. [ORDER_DETAILS.md](./ORDER_DETAILS.md) when building checkout or order UIs  
4. [WEBHOOKS_AND_CRONS.md](./WEBHOOKS_AND_CRONS.md) when wiring payments or Ops

---

## Out of scope for client apps

Do **not** ship these secrets in mobile / seller apps:

- `CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`, `TABBY_WEBHOOK_SECRET`, Tamara webhook secrets  
- `RAZORPAY_WEBHOOK_SECRET`, `WASLAH_WEBHOOK_SECRET`, Firebase **Admin** credentials  

Clients only use Firebase **client** config + public HTTPS APIs.
