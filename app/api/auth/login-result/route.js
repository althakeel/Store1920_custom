import { NextResponse } from 'next/server';
import {
  normalizeEmail,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '@/lib/authSecurity';
import { createAuthSession } from '@/lib/authSessions';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getAuth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * Record login outcome + register device session after Firebase auth.
 * POST { email, success, idToken?, sessionId? }
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);

    if (!body.success) {
      if (!email) {
        return NextResponse.json({ error: 'Email required' }, { status: 400 });
      }
      const result = await recordFailedLogin(email, 'email');
      return NextResponse.json({
        ok: true,
        ...result,
        message: result.locked
          ? 'Account locked after too many failed attempts.'
          : 'Failed attempt recorded.',
      });
    }

    const idToken = body.idToken || '';
    if (!idToken) {
      return NextResponse.json({ error: 'idToken required on success' }, { status: 400 });
    }

    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const userEmail = normalizeEmail(decoded.email || email);

    if (userEmail) await recordSuccessfulLogin(userEmail, 'email');
    await recordSuccessfulLogin(uid, 'uid');

    await connectDB();
    const user = await User.findById(uid).select('twoFactorEnabled').lean();
    const session = await createAuthSession(uid, request, {
      sessionId: body.sessionId || undefined,
    });

    return NextResponse.json({
      ok: true,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      twoFactorRequired: Boolean(user?.twoFactorEnabled),
      emailVerified: Boolean(decoded.email_verified),
    });
  } catch (error) {
    console.error('[auth/login-result]', error);
    return NextResponse.json({ error: 'Could not record login' }, { status: 500 });
  }
}
