# Store1920 Webhooks & Crons

**Audience:** Backend / DevOps / payment ops  
**Do not call these from shopper or seller mobile apps.**  
**Last updated:** 2026-07-14

Index: [README.md](./README.md) · Overview: [API_OVERVIEW.md](./API_OVERVIEW.md)

---

## 1. Crons (`/api/cron/*`)

### Auth (all)

```http
Authorization: Bearer <CRON_SECRET>
```

If `CRON_SECRET` is missing or mismatched → `401`. Fail closed.

Wire in `vercel.json` (Vercel Cron) or external scheduler with the same secret.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/cron/reconcile-payments` | Re-check Stripe/Tabby/Tamara (and card) orders stuck unpaid but paid at provider |
| GET | `/api/cron/waslah-auto-ship` | Process due Waslah auto-ship jobs |
| GET | `/api/cron/abandoned-checkout-whatsapp` | Send due abandoned-cart WhatsApp reminders |
| GET | `/api/cron/behavioral-triggers` | Run enabled behavioral triggers |
| GET | `/api/cron/daily-admin-orders-digest` | Daily admin orders email (`?dryRun=1` supported) |
| GET | `/api/cron/product-ai-autofill` | Process next bulk AI product autofill queue item |

Seller can also trigger payment recheck:

- `POST /api/store/orders/reconcile-payments`
- `POST /api/store/orders/[orderId]/recheck-payment`

---

## 2. Payment webhooks

After checkout, apps should also call shopper `verify-*` endpoints (see [MOBILE_APP_API.md](./MOBILE_APP_API.md)). Webhooks are the server source of truth for provider events.

### Stripe

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/stripe` | Header `stripe-signature` + `STRIPE_WEBHOOK_SECRET` |
| POST | `/api/stripe/webhook` | Alias → same handler |

### Tabby

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/tabby/webhook` | `TABBY_WEBHOOK_SECRET` via custom header (`TABBY_WEBHOOK_HEADER`, default `x-tabby-signature`) **or** `Authorization: Bearer` |

Seller registration helpers: `/api/store/tabby/webhooks`.

### Tamara

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/tamara/webhook` | Tamara token verification; **server re-fetches** order from Tamara (body not trusted alone) |

### Razorpay

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/razorpay/webhook` | `x-razorpay-signature` HMAC vs `RAZORPAY_WEBHOOK_SECRET` |
| POST | `/api/webhooks/razorpay` | Same signature; broader settlement/transfer events |

Client payment start/verify (not webhooks): `/api/razorpay/order`, `/api/razorpay/verify`.

---

## 3. Shipping & WhatsApp webhooks

### Waslah

| Method | Path | Auth |
|--------|------|------|
| POST, PUT | `/api/webhooks/waslah` | `WASLAH_WEBHOOK_SECRET` via `x-waslah-secret` or `Authorization: Bearer` (required in production) |

### Order confirm (WhatsApp)

| Method | Path | Auth |
|--------|------|------|
| GET, POST | `/api/webhooks/order-confirm` | `ORDER_CONFIRM_WEBHOOK_SECRET` or `WABA_WEBHOOK_SECRET` as Bearer or `x-webhook-secret` |

Also related: `/api/order-confirm-webhook` (if mounted) — prefer the `webhooks/order-confirm` path documented in WhatsApp integration docs.

Messaging detail: [WHATSAPP_INTEGRATION_API.md](./WHATSAPP_INTEGRATION_API.md).

---

## 4. Env secret cheat sheet

| Secret | Used by |
|--------|---------|
| `CRON_SECRET` | All `/api/cron/*` |
| `STRIPE_WEBHOOK_SECRET` | Stripe |
| `TABBY_WEBHOOK_SECRET` (+ optional `TABBY_WEBHOOK_HEADER`) | Tabby |
| Tamara webhook token helpers | Tamara (`lib/tamara`) |
| `RAZORPAY_WEBHOOK_SECRET` | Both Razorpay webhook paths |
| `WASLAH_WEBHOOK_SECRET` | Waslah |
| `ORDER_CONFIRM_WEBHOOK_SECRET` / `WABA_WEBHOOK_SECRET` | Order-confirm WhatsApp |

Never embed these in mobile, Electron, or public repos beyond server env.

---

## 5. Related shopper confirm APIs

| Method | Path | When |
|--------|------|------|
| POST | `/api/orders/verify-stripe` | After Stripe success return |
| POST | `/api/orders/verify-tabby` | After Tabby return |
| POST | `/api/orders/verify-tamara` | After Tamara return |
| POST | `/api/payment-cancelled` | User abandons payment UI |

These are safe for the app (with order ownership / session rules). Webhooks remain required for reliability when the user never returns to the app.
