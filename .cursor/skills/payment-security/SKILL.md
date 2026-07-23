---
name: payment-security
description: Store1920 PCI-aligned payment security — hosted gateways, no card storage, 3DS, fraud scoring, refund dual-control, transaction logs. Use when editing checkout payments, Stripe sessions, refunds, or /store/payment-security.
---

# Payment security skill

## Rules

1. **Never accept or persist PAN/CVV** — reject with `assertNoCardFields`; sanitize logs with `sanitizePaymentPayload`.
2. **Card payments = hosted Stripe Checkout** (or BNPL redirects). Do not add Stripe Elements / raw card forms without a PCI scope review.
3. **Always spread `stripeSecureCheckoutOptions()`** into `checkout.sessions.create`.
4. **Mark paid only** via trusted provider verification / signed webhooks (`recordTrustedOrderPayment`).
5. **Refunds**: use refund authorization flow for Stripe; Tabby/Tamara remain provider-dashboard + webhook reversal.
6. Dashboard UI under `/store` stays **English LTR**.

## Key paths

- `lib/paymentSecurity.js`, `lib/paymentFraud.js`, `lib/paymentTransactionLog.js`, `lib/paymentRefundAuth.js`
- `app/store/payment-security/page.jsx`
- `app/api/store/payment-security/**`
- `docs/PAYMENT_SECURITY.md`
