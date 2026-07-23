# Payment security

Store1920 reduces PCI scope with **hosted payment pages** (Stripe Checkout, Tabby, Tamara). Card PANs never hit merchant servers or MongoDB.

## Checklist mapping

| Requirement | Implementation |
|---|---|
| PCI-DSS | SAQ A posture — hosted checkout only; documented in `/store/payment-security` |
| Never store card numbers | `assertNoCardFields` rejects PAN/CVV on order APIs; logs sanitized via `sanitizePaymentPayload` |
| Tokenized payments | Provider session / PaymentIntent / order IDs only on `Order` |
| 3D Secure | `stripeSecureCheckoutOptions()` → `request_three_d_secure: any` (override with `STRIPE_3DS_MODE=automatic`) |
| Secure payment gateway | Stripe + Tabby + Tamara; signed webhooks; authoritative re-fetch before mark-paid |
| Fraud detection | `evaluateCheckoutFraud` velocity / high-amount / guest signals; blocks score ≥ 70 |
| Payment verification | Existing `recordTrustedOrderPayment` + provider verify routes; now also writes `PAYMENT_VERIFIED` logs |
| Refund authorization | Dual-control Stripe refunds via `/api/store/payment-security/refunds` |
| Transaction logs | Append-only `PaymentTransactionLog` model + dashboard Logs tab |

## Seller UI

`/store/payment-security` — overview, transaction logs, refund request / approve / reject.

## APIs

- `GET /api/store/payment-security` — config
- `GET /api/store/payment-security?view=logs`
- `GET /api/store/payment-security?view=refunds`
- `POST /api/store/payment-security/refunds` — request
- `PUT /api/store/payment-security/refunds` — approve | reject

## Env (optional)

```
STRIPE_3DS_MODE=any|automatic
PAYMENT_FRAUD_VELOCITY_MINUTES=60
PAYMENT_FRAUD_MAX_ORDERS_EMAIL=8
PAYMENT_FRAUD_MAX_ORDERS_IP=12
PAYMENT_FRAUD_HIGH_AMOUNT_AED=5000
PAYMENT_REFUND_REQUIRE_SECOND_APPROVER=true
PAYMENT_REFUND_MAX_AUTO_APPROVE_AED=0
```

## Key files

- `lib/paymentSecurity.js`, `lib/paymentFraud.js`, `lib/paymentTransactionLog.js`, `lib/paymentRefundAuth.js`
- `models/PaymentTransactionLog.js`, `models/PaymentRefundAuthorization.js`
- Stripe session create sites use `stripeSecureCheckoutOptions()`
