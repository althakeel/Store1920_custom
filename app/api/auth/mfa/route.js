import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import { issueOtp, verifyOtp } from '@/lib/authOtp';
import { sendMail } from '@/lib/email';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

async function requireUser(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    return await getAuth().verifyIdToken(authHeader.slice(7));
  } catch {
    return null;
  }
}

/** Send MFA OTP (email-based second factor) */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    // Allow either authenticated user OR post-password idToken for login MFA step
    let decoded = await requireUser(request);
    if (!decoded && body.idToken) {
      try {
        decoded = await getAuth().verifyIdToken(body.idToken);
      } catch {
        decoded = null;
      }
    }
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    let user = await User.findById(decoded.uid).select('twoFactorEnabled email').lean();
    if (!user) {
      user = await User.create({
        _id: decoded.uid,
        firebaseUid: decoded.uid,
        email: decoded.email || '',
        twoFactorEnabled: false,
      });
      user = user.toObject ? user.toObject() : user;
    }
    if (!user?.twoFactorEnabled && !body.setup) {
      return NextResponse.json({ error: 'MFA is not enabled for this account' }, { status: 400 });
    }

    const email = decoded.email || user?.email;
    if (!email) {
      return NextResponse.json({ error: 'No email for MFA delivery' }, { status: 400 });
    }

    const { code, expiresAt } = await issueOtp(decoded.uid, 'mfa');
    await sendMail({
      to: email,
      subject: 'Your Store1920 login code',
      html: `<p>Your multi-factor authentication code is <strong>${code}</strong>.</p><p>Expires ${expiresAt.toISOString()}.</p>`,
      fromType: 'transactional',
    }).catch((e) => console.error('[mfa] mail', e));

    return NextResponse.json({ ok: true, message: 'MFA code sent to your email' });
  } catch (error) {
    console.error('[mfa send]', error);
    return NextResponse.json({ error: 'Could not send MFA code' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const decoded = await requireUser(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();
    const user = await User.findById(decoded.uid).select('twoFactorEnabled').lean();
    return NextResponse.json({
      twoFactorEnabled: Boolean(user?.twoFactorEnabled),
      emailVerified: Boolean(decoded.email_verified),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Could not load MFA status' }, { status: 500 });
  }
}

/** Verify MFA OTP; optionally enable MFA (setup: true) */
export async function PUT(request) {
  try {
    const body = await request.json().catch(() => ({}));
    let decoded = await requireUser(request);
    if (!decoded && body.idToken) {
      try {
        decoded = await getAuth().verifyIdToken(body.idToken);
      } catch {
        decoded = null;
      }
    }
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await verifyOtp(decoded.uid, 'mfa', body.code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (body.setup === true || body.enable === true) {
      await connectDB();
      await User.findOneAndUpdate(
        { _id: decoded.uid },
        {
          $set: { twoFactorEnabled: true, email: decoded.email || undefined },
          $setOnInsert: { _id: decoded.uid, firebaseUid: decoded.uid },
        },
        { upsert: true, new: true },
      );
    }

    if (body.disable === true) {
      await connectDB();
      await User.findByIdAndUpdate(decoded.uid, { twoFactorEnabled: false });
    }

    return NextResponse.json({ ok: true, mfaVerified: true });
  } catch (error) {
    console.error('[mfa verify]', error);
    return NextResponse.json({ error: 'Could not verify MFA' }, { status: 500 });
  }
}
