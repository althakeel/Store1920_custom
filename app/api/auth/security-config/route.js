import { NextResponse } from 'next/server';
import { passwordPolicyPublic } from '@/lib/passwordPolicy';
import { AUTH_LOCK, SESSION_IDLE_MS, SESSION_MAX_MS } from '@/lib/authSecurity';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    password: passwordPolicyPublic(),
    lockout: AUTH_LOCK,
    session: {
      idleMs: SESSION_IDLE_MS,
      maxMs: SESSION_MAX_MS,
      jwt: 'Firebase ID tokens (~1h). Refresh tokens managed by Firebase; revokeRefreshTokens on logout-all.',
      hashing: 'Passwords are hashed by Firebase Auth (scrypt). MongoDB never stores account passwords.',
    },
    captcha: {
      googleConfigured: Boolean(
        process.env.RECAPTCHA_SECRET_KEY || process.env.GOOGLE_RECAPTCHA_SECRET_KEY,
      ),
      siteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '',
      mathFallback: true,
    },
  });
}
