# Mobile Features — App Home Banners

Overview of the **mobile app home banners** system (Store dashboard + public APIs) for Store1920.

Related:
- Homepage API map: [MOBILE_HOME_PAGE_APIS.md](./MOBILE_HOME_PAGE_APIS.md)
- Full shopper API: [MOBILE_APP_API.md](./MOBILE_APP_API.md)

---

## 1. Purpose

Store owners configure mobile-only home banners from the dashboard.  
The Flutter / native app loads them via **public GET APIs** — no login required.

| Item | Detail |
|------|--------|
| Dashboard | `/store/mobile-features` |
| Audience | Android / iOS app home screen |
| Website | These banners are **API-only** — they are **not** shown on the website |

**Base URL:** `https://store1920.com`

---

## 2. Four banner sections

Recommended home order:

| # | Section | Dashboard | Public GET | Max | Default height |
|---|---------|-----------|------------|-----|----------------|
| 1 | Large hero slider | Large App Banners | `/api/store/mobile-banner-slider` | 8 | `168` px (`100`–`400`) |
| 2 | Small strips | Small Promo Banners | `/api/store/mobile-small-banners` | 12 | `68` px (`40`–`200`) |
| 3 | Promo cards | Promo Card Banners | `/api/store/mobile-promo-cards` | 8 | `132` px (`80`–`300`) |
| 4 | Category tiles | Category Tile Banners | `/api/store/mobile-tile-banners` | 12 | Layout (2 per row) |

**Hide rule:** if `enabled === false` **or** `slides` / `tiles` is empty → do not render that section.

Combined bag (all four): `GET /api/public/mobile-features` (optional `?storeId=`).

---

## 3. Auth rules

| Method | Auth |
|--------|------|
| `GET` (all four section APIs + public bag) | **Public** — no Bearer. Section GETs allowlisted in `proxy.ts` |
| `POST` / `PUT` (save) | `Authorization: Bearer <firebase-token>` (seller) |

---

## 4. Shared response fields

### Top-level (hero / small / promo)

```json
{
  "enabled": true,
  "slideIntervalSeconds": 4,
  "heightPx": 168,
  "slides": []
}
```

### Each slide

```json
{
  "image": "https://...",
  "link": "/offers",
  "path": "/offers",
  "title": "Festival Sale"
}
```

Promo slides may include `showAdBadge: true|false`.

### Tiles

`title`, `subtitle`, `buttonText`, `image`, `link` / `path` (no `heightPx`).

**Navigation:** use `path ?? link`. `/` → in-app route; `http` → external / in-app browser.

---

## 5. Dashboard

`/store/mobile-features` → four editors:

- Enable / disable, auto-slide interval, height (`heightPx`)
- Add / remove / reorder slides or tiles
- Image upload with client compression (max **4 MB** after compress)

Helpers: `lib/mobileBannerLayout.js`, `lib/compressImageForUpload.js`.

Storage: `StorePreference.mobileFeatures` (four sections). Legacy `banners.homeBanners` migrates into `bannerSlider`.

---

## 6. File map

```
app/store/mobile-features/                 ← hub + section editors
app/api/store/mobile-banner-slider/        ← hero
app/api/store/mobile-small-banners/        ← strips
app/api/store/mobile-promo-cards/          ← promo
app/api/store/mobile-tile-banners/         ← tiles
app/api/public/mobile-features/            ← combined public bag
lib/mobileBannerLayout.js
lib/mobileFeatures.js
lib/mobileBannerApi.js
proxy.ts                                   ← public GET allowlist
```

---

## 7. Flutter checklist (short)

1. Call all four GETs on home load (no auth), or one call to `/api/public/mobile-features`.
2. Skip a section when `enabled` is false or list is empty.
3. Set banner widget `height:` from `heightPx`.
4. Navigate with `path ?? link`.
5. Auto-play with `slideIntervalSeconds`.
6. Cache images; handle empty / network errors gracefully.
