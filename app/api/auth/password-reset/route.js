import { NextResponse } from 'next/server';
import {
  normalizeEmail,
  generateToken,
  hashSecret,
  verifyMathCaptcha,
  verifyGoogleRecaptcha,
  getClientIp,
} from '@/lib/authSecurity';
import { issueOtp, verifyOtp } from '@/lib/authOtp';
import { sendMail } from '@/lib/email';
import { getAuth } from '@/lib/firebase-admin';
import { setCachedData, getCachedData, deleteCacheKey } from '@/lib/cache';

export const dynamic = 'force-dynamic';

/**
 * Request password reset — issues a one-time token emailed to the user.
 * Firebase sendPasswordResetEmail is also used from the client when possible;
 * this route provides server-side hashed tokens + rate-friendly email.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const google = await verifyGoogleRecaptcha(body.recaptchaToken, getClientIp(request));
    let captchaOk = google.ok;
    if (!google.ok && google.skipped) {
      captchaOk = verifyMathCaptcha(body.captchaChallengeId, body.captchaAnswer);
    }
    if (!captchaOk) {
      return NextResponse.json({ error: 'CAPTCHA verification failed' }, { status: 400 });
    }

    // Always return success to avoid email enumeration
    const generic = {
      ok: true,
      message: 'If an account exists for that email, a reset link has been sent.',
    };

    let userRecord = null;
    try {
      userRecord = await getAuth().getUserByEmail(email);
    } catch {
      return NextResponse.json(generic);
    }

    const resetToken = generateToken(32);
    const cacheKey = `pwdreset:${hashSecret(resetToken)}`;
    setCachedData(cacheKey, { uid: userRecord.uid, email, createdAt: Date.now() }, 900);

    // Also store OTP for alternate entry
    const { code, expiresAt } = await issueOtp(email, 'password_reset');

    const origin = process.env.NEXT_PUBLIC_SITE_URL
      || process.env.SITE_URL
      || request.headers.get('origin')
      || 'https://store1920.com';
    const resetUrl = `${origin.replace(/\/$/, '')}/sign-in?resetToken=${resetToken}&email=${encodeURIComponent(email)}`;

    try {
      await sendMail({
        to: email,
        subject: 'Reset your Store1920 password',
        html: `
          <p>We received a request to reset your password.</p>
          <p><a href="${resetUrl}">Reset password</a></p>
          <p>Or enter this code: <strong>${code}</strong></p>
          <p>This expires at ${expiresAt.toISOString()}. If you did not request this, ignore this email.</p>
        `,
        fromType: 'transactional',
      });
    } catch (mailErr) {
      console.error('[password-reset] email failed', mailErr);
    }

    // Firebase link as well (best-effort)
    try {
      const link = await getAuth().generatePasswordResetLink(email, {
        url: `${origin.replace(/\/$/, '')}/sign-in`,
      });
      // Prefer our emailed link; Firebase link available for logging/debug
      void link;
    } catch (e) {
      console.warn('[password-reset] Firebase link:', e?.message || e);
    }

    return NextResponse.json(generic);
  } catch (error) {
    console.error('[password-reset]', error);
    return NextResponse.json({ error: 'Could not process reset request' }, { status: 500 });
  }
}

/**
 * Confirm reset with token or OTP + set new password via Admin SDK.
 * POST { email, newPassword, resetToken? , otp? }
 */
export async function PUT(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const newPassword = String(body.newPassword || '');
    const { validatePasswordStrength } = await import('@/lib/passwordPolicy');
    const policy = validatePasswordStrength(newPassword);
    if (!policy.ok) {
      return NextResponse.json({ error: policy.message }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    let uid = null;
    if (body.resetToken) {
      const cacheKey = `pwdreset:${hashSecret(body.resetToken)}`;
      const cached = getCachedData(cacheKey);
      deleteCacheKey(cacheKey);
      if (!cached || cached.email !== email) {
        return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
      }
      uid = cached.uid;
    } else if (body.otp) {
      const verified = await verifyOtp(email, 'password_reset', body.otp);
      if (!verified.ok) {
        return NextResponse.json({ error: verified.error }, { status: 400 });
      }
      try {
        const userRecord = await getAuth().getUserByEmail(email);
        uid = userRecord.uid;
      } catch {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: 'resetToken or otp required' }, { status: 400 });
    }

    await getAuth().updateUser(uid, { password: newPassword });
    try {
      await getAuth().revokeRefreshTokens(uid);
    } catch {
      // non-fatal
    }

    return NextResponse.json({ ok: true, message: 'Password updated. Please sign in.' });
  } catch (error) {
    console.error('[password-reset confirm]', error);
    return NextResponse.json({ error: 'Could not reset password' }, { status: 500 });
  }
}
