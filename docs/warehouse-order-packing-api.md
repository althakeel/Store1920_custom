# Warehouse Order Packing API

APIs for the warehouse **Packed** button and packed history screen.

| Endpoint | For |
|----------|-----|
| `POST /api/store/orders/pack` | Packed button |
| `GET /api/store/orders/packed` | Packed history page |
| `warehousePacking` on order / lookup | Show already packed |

When an order is packed:

1. `warehousePacking.packed = true` (with who/when)
2. Order **status** → `WAITING_FOR_PICKUP` (Awaiting Pickup)
3. Customer gets a status email
4. `/store/orders` shows a **Packed** tag

---

## Auth

Same as other store APIs:

```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json
```

---

## POST `/api/store/orders/pack`

Mark one order packed.

### Body

```json
{
  "orderId": "6a54c478b936dc9f3e3e9387",
  "notes": "optional warehouse note"
}
```

Or look up by AWB / order number:

```json
{
  "q": "62007200700841"
}
```

Optional: `"force": true` to re-run pack + email if already packed.

### Success response

```json
{
  "success": true,
  "alreadyPacked": false,
  "statusChanged": true,
  "previousStatus": "PROCESSING",
  "status": "WAITING_FOR_PICKUP",
  "emailSent": true,
  "message": "Order packed and set to Awaiting Pickup",
  "warehousePacking": {
    "packed": true,
    "packedAt": "2026-07-13T12:00:00.000Z",
    "packedByUid": "...",
    "packedByName": "Warehouse staff",
    "packedByEmail": "staff@example.com",
    "previousStatus": "PROCESSING",
    "notes": null,
    "emailSentAt": "2026-07-13T12:00:00.000Z"
  },
  "order": { "...full order..." }
}
```

If already packed:

```json
{
  "success": true,
  "alreadyPacked": true,
  "message": "Order is already packed",
  "warehousePacking": { "packed": true, "...": "..." }
}
```

Blocked for: `CANCELLED`, `DELIVERED`, `RETURNED`, `RETURN`, `RTO`, return-flow statuses.

---

## GET `/api/store/orders/packed`

Packed history (newest first).

### Query

| Param | Default | Description |
|-------|---------|-------------|
| `page` | `1` | Page number |
| `limit` | `25` | Max 100 |
| `fromDate` | | Optional ISO / `YYYY-MM-DD` |
| `toDate` | | Optional |

### Response

```json
{
  "success": true,
  "page": 1,
  "limit": 25,
  "total": 12,
  "totalPages": 1,
  "orders": [
    {
      "_id": "...",
      "shortOrderNumber": 616815,
      "status": "WAITING_FOR_PICKUP",
      "warehousePacking": { "packed": true, "packedAt": "...", "packedByName": "..." }
    }
  ]
}
```

---

## Lookup — already packed

`GET /api/store/orders/lookup?q=...` includes:

```json
{
  "order": {
    "warehousePacking": {
      "packed": true,
      "packedAt": "...",
      "packedByName": "..."
    }
  }
}
```

Use `warehousePacking.packed === true` to show **Already packed** in the warehouse app.

---

## Store dashboard

On `/store/orders`, packed orders get a teal **Packed** tag in the Tags column.
