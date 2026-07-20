# Store1920 Platform Admin API

**Audience:** Platform operators (Al Thakeel admin)  
**Base path:** `https://store1920.com/api/admin/...`  
**Auth:** Firebase Bearer + email allowlist  
**Last updated:** 2026-07-14

Index: [README.md](./README.md) · Overview: [API_OVERVIEW.md](./API_OVERVIEW.md)

---

## 1. Authentication

```http
Authorization: Bearer <Firebase ID token>
```

1. Verify Firebase ID token → `uid`, `email`
2. `authAdmin(uid, email)` — email must appear in:
   - `ADMIN_EMAIL` and/or
   - `NEXT_PUBLIC_ADMIN_EMAIL`  
   (comma-separated lists)

### Gate

```http
GET /api/admin/is-admin
```

Returns whether the caller is a platform admin.

---

## 2. Dashboard

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/dashboard` | Platform metrics |

---

## 3. Stores

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/stores` | List stores |
| POST, GET | `/api/admin/approve-store` | Approve / list pending |
| POST | `/api/admin/toggle-store` | Enable / disable store |
| POST | `/api/admin/delete-store` | Delete store |

Seller-facing store creation lives under `/api/store/create`; admin decides approval here.

---

## 4. Categories

| Method | Path | Purpose |
|--------|------|---------|
| GET, POST | `/api/admin/categories` | List / create global categories |
| PUT, DELETE | `/api/admin/categories/[id]` | Update / delete |

---

## 5. Coupons

| Method | Path | Purpose |
|--------|------|---------|
| GET, POST, DELETE | `/api/admin/coupon` | Platform-level coupons |

Seller coupons: `/api/store/coupons` (see [STORE_DASHBOARD_API.md](./STORE_DASHBOARD_API.md)).

---

## 6. Homepage / merchandising

| Method | Path | Purpose |
|--------|------|---------|
| GET, PUT | `/api/admin/home-selection` | Legacy single selection |
| GET, POST | `/api/admin/home-selections` | Selections list / create |
| GET, PUT, DELETE | `/api/admin/home-selections/[id]` | By id |
| GET, POST | `/api/admin/home-sections` | Sections list / create |
| GET, PUT, DELETE | `/api/admin/home-sections/[id]` | By id |
| GET, POST | `/api/admin/section4` | Section4 blocks |
| GET, PUT, DELETE | `/api/admin/section4/[id]` | By id |
| GET, POST | `/api/admin/grid-products` | Grid products |

Storefront reads related public content via `/api/home/sections`, `/api/home-selection`, `/api/public/*` (see [MOBILE_APP_API.md](./MOBILE_APP_API.md)).

---

## 7. Media & inventory

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/admin/upload-image` | Admin image upload |
| GET | `/api/admin/inventory-history` | Cross-store inventory history |

---

## 8. Approx size

**19** route handlers under `app/api/admin/**`.

Admin must never share allowlist credentials with shopper or seller apps. Use a dedicated Firebase user whose email is on the allowlist.
