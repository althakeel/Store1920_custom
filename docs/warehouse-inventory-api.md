# Warehouse Inventory API

API reference for the **Store1920 warehouse / stock-update Android app**.

Use these endpoints to:

1. **Find a product** by SKU, name, or product ID  
2. **Read stock details** (simple products and variants)  
3. **Add stock** from the warehouse app  
4. **View update history** (optional audit log)

All store APIs require a logged-in **seller / store team** account with access to the store dashboard.

**Firebase setup for Android:** see [warehouse-android-firebase-setup.md](./warehouse-android-firebase-setup.md)

---

## Base URL

| Environment | Base URL |
|-------------|----------|
| Production  | `https://YOUR-DOMAIN.com` |
| Local dev   | `http://localhost:3000` |

All paths below are relative to this base URL.

---

## Authentication

Every request must include a **Firebase ID token** in the header:

```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json
```

### How to get the token (Android)

1. Sign in with **Firebase Auth** using the same account that has store dashboard access (email/password or Google — same as `/store/login`).
2. Call `FirebaseAuth.getInstance().currentUser?.getIdToken(true)`.
3. Send that token on every API call.
4. Refresh the token when it expires (typically every hour).

### Auth errors

| Status | Meaning |
|--------|---------|
| `401 Unauthorized` | Missing/invalid token, or user is not linked to a store |
| `404 Not Found` | Product does not belong to this store |

---

## Recommended app flow

```
Scan barcode (SKU)
       ↓
GET /api/store/inventory?q={SKU}&historyOnly=false
       ↓
Show product name, image, current stock, variants
       ↓
User enters quantity to add
       ↓
PATCH /api/store/inventory  { productId, stockToAdd }
       ↓
Show success + new stock level
```

---

## 1. Search / fetch product (by SKU or name)

**`GET /api/store/inventory`**

Search products in the **current store** (store is resolved from the logged-in user).

### Query parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | — | Search by **SKU** or **product name** (case-insensitive, partial match) |
| `productId` | string | — | Fetch one product by MongoDB `_id` (skips date filters) |
| `historyOnly` | boolean | `true` | When `true`, only products with a previous stock update are returned. **Set to `false` for barcode/SKU lookup.** |
| `suggest` | boolean | `false` | If `true`, returns a short autocomplete list (`suggestions`) |
| `todayOnly` | boolean | `false` | Filter to products updated today |
| `fromDate` | string | — | Filter from date (`YYYY-MM-DD`) |
| `toDate` | string | — | Filter to date (`YYYY-MM-DD`) |
| `page` | number | `1` | Page number |
| `limit` | number | `25` | Page size (max `100`; suggest mode max `12`) |

### Example — lookup by SKU (warehouse scan)

```http
GET /api/store/inventory?q=SKU-12345&historyOnly=false&limit=10
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

### Example — fetch exact product by ID

```http
GET /api/store/inventory?productId=665a1b2c3d4e5f678901234
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

### Example — autocomplete while typing

```http
GET /api/store/inventory?suggest=true&q=iphone&limit=8
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

### Success response (`200`)

**List mode** (default):

```json
{
  "items": [
    {
      "_id": "665a1b2c3d4e5f678901234",
      "name": "Wireless Mouse",
      "sku": "SKU-12345",
      "hasVariants": false,
      "stockQuantity": 42,
      "currentStock": 42,
      "inStock": true,
      "variantStocks": [],
      "stockUpdatedAt": "2026-06-16T10:30:00.000Z",
      "image": "https://cdn.example.com/products/mouse.jpg"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  },
  "todayUpdatedCount": 3
}
```

**Suggest mode** (`suggest=true`):

```json
{
  "suggestions": [
    {
      "_id": "665a1b2c3d4e5f678901234",
      "name": "Wireless Mouse",
      "sku": "SKU-12345",
      "hasVariants": false,
      "stockQuantity": 42,
      "currentStock": 42,
      "inStock": true,
      "variantStocks": [],
      "image": "https://cdn.example.com/products/mouse.jpg"
    }
  ]
}
```

### Product fields (inventory summary)

| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | Product ID — **required for stock update** |
| `name` | string | Product title |
| `sku` | string | SKU / barcode value (may be empty on older products) |
| `hasVariants` | boolean | `true` if product has size/color variants |
| `stockQuantity` | number | Stored stock field (for non-variant products) |
| `currentStock` | number | Effective stock (sum of variant stocks if applicable) |
| `inStock` | boolean | Whether product is marked in stock on storefront |
| `variantStocks` | array | Per-variant stock breakdown (see below) |
| `stockUpdatedAt` | string \| null | Last stock update timestamp (ISO 8601) |
| `image` | string | First product image URL |

### Variant stock object

When `hasVariants` is `true`:

```json
"variantStocks": [
  {
    "index": 0,
    "label": "Black / M",
    "stock": 5
  },
  {
    "index": 1,
    "label": "White / L",
    "stock": 12
  }
]
```

| Field | Description |
|-------|-------------|
| `index` | Variant index — **use in PATCH when adding variant stock** |
| `label` | Human-readable variant label (color / size / bundle) |
| `stock` | Current stock for that variant |

### Android tip — exact SKU match

Search uses partial match. After fetching results, prefer the item where:

```kotlin
item.sku.equals(scannedSku, ignoreCase = true)
```

If multiple matches, show a picker to the user.

---

## 2. Add stock (warehouse update)

**`PATCH /api/store/inventory`**

Adds stock to an existing product. This **adds to current stock** (does not replace it). Every update is recorded in the inventory audit log.

### Simple product (no variants)

```http
PATCH /api/store/inventory
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Content-Type: application/json

{
  "productId": "665a1b2c3d4e5f678901234",
  "stockToAdd": 10
}
```

### Product with variants

Send stock per variant using the `index` from `variantStocks`:

```http
PATCH /api/store/inventory
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Content-Type: application/json

{
  "productId": "665a1b2c3d4e5f678901234",
  "variants": [
    { "index": 0, "stockToAdd": 5 },
    { "index": 1, "stockToAdd": 3 }
  ]
}
```

### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | string | Yes | Product `_id` from search response |
| `stockToAdd` | number | Simple products | Positive quantity to **add** |
| `variants` | array | Variant products | List of `{ index, stockToAdd }` |

> **Note:** For variant products you cannot use `stockToAdd` at the top level — use `variants[]` instead.

### Success response (`200`)

```json
{
  "success": true,
  "message": "Added 10 to stock successfully.",
  "product": {
    "_id": "665a1b2c3d4e5f678901234",
    "name": "Wireless Mouse",
    "sku": "SKU-12345",
    "hasVariants": false,
    "stockQuantity": 52,
    "currentStock": 52,
    "inStock": true,
    "variantStocks": [],
    "stockUpdatedAt": "2026-06-16T11:00:00.000Z",
    "image": "https://cdn.example.com/products/mouse.jpg"
  }
}
```

### Error responses

| Status | Example `error` | Cause |
|--------|-----------------|-------|
| `400` | `Product ID is required` | Missing `productId` |
| `400` | `Enter a quantity greater than 0 to add to stock.` | Invalid or zero quantity |
| `400` | `This product uses variants. Add stock per variant instead.` | Sent `stockToAdd` on a variant product |
| `400` | `Enter stock to add for at least one variant.` | Variant product with empty `variants` |
| `404` | `Product not found` | Wrong ID or product from another store |

---

## 3. Inventory update history (optional)

**`GET /api/store/inventory/history`**

Returns an audit log of stock changes (who changed what, when).

### Query parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search by product name or SKU |
| `productId` | string | Filter to one product |
| `todayOnly` | boolean | Only today's entries |
| `fromDate` | string | From date (`YYYY-MM-DD`) |
| `toDate` | string | To date (`YYYY-MM-DD`) |
| `page` | number | Page number (default `1`) |
| `limit` | number | Page size (default `25`, max `100`) |

### Example

```http
GET /api/store/inventory/history?productId=665a1b2c3d4e5f678901234&limit=20
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

### Success response (`200`)

```json
{
  "items": [
    {
      "_id": "...",
      "productId": "665a1b2c3d4e5f678901234",
      "productName": "Wireless Mouse",
      "sku": "SKU-12345",
      "action": "add_stock",
      "actionLabel": "Add stock",
      "quantityDelta": 10,
      "previousStock": 42,
      "newStock": 52,
      "actorName": "Warehouse Staff",
      "actorEmail": "staff@store.com",
      "createdAt": "2026-06-16T11:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  },
  "todayCount": 5
}
```

---

## 4. Set absolute stock (bulk — advanced)

**`PATCH /api/store/product/bulk-update`**

Sets stock to an **exact number** (not add). Useful for bulk corrections from the web dashboard; the warehouse app should normally prefer **`PATCH /api/store/inventory`** (add stock).

```http
PATCH /api/store/product/bulk-update
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Content-Type: application/json

{
  "productIds": ["665a1b2c3d4e5f678901234"],
  "stockQuantity": 100
}
```

Also supports `inStock`, `price`, `AED`, `fastDelivery`, `freeShippingEligible`.

---

## 5. Toggle in-stock flag (optional)

**`POST /api/store/stock-toggle`**

Flips `inStock` true/false without changing quantity. Rarely needed for warehouse receiving.

```http
POST /api/store/stock-toggle
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Content-Type: application/json

{
  "productId": "665a1b2c3d4e5f678901234"
}
```

---

## Android integration examples

### Kotlin — search by scanned SKU

```kotlin
suspend fun findProductBySku(idToken: String, sku: String): InventoryProduct? {
    val url = "$BASE_URL/api/store/inventory?q=${Uri.encode(sku)}&historyOnly=false&limit=10"
    val request = Request.Builder()
        .url(url)
        .addHeader("Authorization", "Bearer $idToken")
        .get()
        .build()

    val response = client.newCall(request).execute()
    val body = gson.fromJson(response.body?.string(), InventoryListResponse::class.java)

    return body.items.firstOrNull { it.sku.equals(sku, ignoreCase = true) }
        ?: body.items.firstOrNull()
}
```

### Kotlin — add stock

```kotlin
suspend fun addStock(idToken: String, productId: String, quantity: Int): InventoryProduct {
    val json = JSONObject()
        .put("productId", productId)
        .put("stockToAdd", quantity)

    val request = Request.Builder()
        .url("$BASE_URL/api/store/inventory")
        .addHeader("Authorization", "Bearer $idToken")
        .addHeader("Content-Type", "application/json")
        .patch(json.toString().toRequestBody("application/json".toMediaType()))
        .build()

    val response = client.newCall(request).execute()
    val body = gson.fromJson(response.body?.string(), InventoryPatchResponse::class.java)
    return body.product
}
```

### Kotlin — add stock for variants

```kotlin
val variants = JSONArray()
    .put(JSONObject().put("index", 0).put("stockToAdd", 5))
    .put(JSONObject().put("index", 1).put("stockToAdd", 3))

val json = JSONObject()
    .put("productId", productId)
    .put("variants", variants)
```

---

## cURL quick test

```bash
# 1. Set your Firebase ID token
TOKEN="your-firebase-id-token"

# 2. Search by SKU
curl -s "https://YOUR-DOMAIN.com/api/store/inventory?q=SKU-12345&historyOnly=false" \
  -H "Authorization: Bearer $TOKEN" | jq

# 3. Add 10 units
curl -s -X PATCH "https://YOUR-DOMAIN.com/api/store/inventory" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productId":"665a1b2c3d4e5f678901234","stockToAdd":10}' | jq
```

---

## Important notes for warehouse app

1. **`historyOnly=false`** — Required when looking up products by SKU that may never have been updated through inventory before.
2. **Store scoping** — Users only see/update products for their own store. No `storeId` parameter is needed.
3. **Add vs set** — `PATCH /api/store/inventory` **adds** stock. To set an exact total, use bulk-update (not recommended for daily receiving).
4. **Variants** — Always read `hasVariants` and `variantStocks` before updating; show a variant picker in the app when needed.
5. **SKU may be empty** — Some imported products have no SKU. Allow manual name search as fallback (`q=product name`).
6. **Audit trail** — All inventory PATCH updates are logged with user name/email and timestamp.
7. **Permissions** — Team members need **Inventory** permission in dashboard access settings.

---

## Related docs

| Document | Purpose |
|----------|---------|
| [warehouse-android-firebase-setup.md](./warehouse-android-firebase-setup.md) | Firebase + Android login setup |
| Store inventory UI | `/store/inventory` |
| Store login | `/store/login` |
| Admin inventory history | `/admin/inventory-history` |

---

## Changelog

| Date | Notes |
|------|-------|
| 2026-06-16 | Initial warehouse API documentation |
