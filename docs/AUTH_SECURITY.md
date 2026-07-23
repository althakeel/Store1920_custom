# Authentication & account security

Store1920 uses **Firebase Authentication** for identity. Passwords are never stored in MongoDB; Firebase hashes them with scrypt. This app adds lockout, CAPTCHA, OTP MFA, verification, sessions, and logout-all on top.

## Checklist mapping

| Requirement | Implementation |
|---|---|
| Strong password policy | `lib/passwordPolicy.js` — enforced on register + password reset |
| Password hashing (Argon2/bcrypt) | Firebase Auth scrypt (platform-managed). OTPs/reset tokens use SHA-256 + pepper |
| MFA / OTP | Email OTP via `/api/auth/mfa` + `twoFactorEnabled` on User |
| Email verification | Firebase `sendEmailVerification` + `/api/auth/email-verify` OTP |
| Phone verification | `/api/auth/phone-verify` (Twilio SMS if configured, else email fallback) |
| Secure password reset | `/api/auth/password-reset` — hashed one-time tokens (15m) + OTP |
| Login attempt limits | `AuthSecurity.failedAttempts` via `/api/auth/login-result` |
| Account lock | 5 failures → 15 min lock (`AUTH_LOCK` in `lib/authSecurity.js`) |
| CAPTCHA | Math challenge `/api/auth/captcha`; optional Google reCAPTCHA env |
| Session timeout | Client idle timer (`AuthSessionGuard`) + `AUTH_SESSION_IDLE_MS` |
| Device/session management | `AuthSession` model + `/dashboard/security` |
| JWT expiry / refresh | Firebase ID token (~1h) + refresh tokens; documented in `/api/auth/security-config` |
| Logout all devices | `revokeRefreshTokens` + revoke Mongo sessions |

## Env vars (optional)

```
AUTH_TOKEN_PEPPER=
AUTH_SESSION_IDLE_MS=1800000
AUTH_SESSION_MAX_MS=604800000
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

## Customer UI

- Sign-in modal: CAPTCHA, strong password, forgot/reset, MFA step
- `/dashboard/security`: verify email/phone, MFA, devices, logout all

## APIs

- `GET /api/auth/security-config`
- `GET /api/auth/captcha`
- `POST /api/auth/pre-login`
- `POST /api/auth/login-result`
- `POST|PUT /api/auth/password-reset`
- `POST|PUT /api/auth/email-verify`
- `POST|PUT /api/auth/phone-verify`
- `GET|POST|PUT /api/auth/mfa`
- `GET|POST|DELETE /api/auth/sessions`
