import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import { issueOtp, verifyOtp } from '@/lib/authOtp';
import { getOrCreateSecurity } from '@/lib/authSecurity';
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

function normalizePhone(phone = '') {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits;
}

/** Send phone verification OTP (emailed when SMS provider not configured; code still required) */
export async function POST(request) {
  try {
    const decoded = await requireUser(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const phone = normalizePhone(body.phone);
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
    }

    const { code, expiresAt } = await issueOtp(phone, 'phone_verify');

    // Prefer SMS if TWILIO configured; otherwise email the code to the account holder
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_FROM_NUMBER;
    let deliveredVia = 'email';

    if (twilioSid && twilioToken && twilioFrom) {
      try {
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: phone,
              From: twilioFrom,
              Body: `Store1920 verification code: ${code}`,
            }),
          },
        );
        if (res.ok) deliveredVia = 'sms';
      } catch (e) {
        console.warn('[phone-verify] twilio', e?.message || e);
      }
    }

    if (deliveredVia === 'email' && decoded.email) {
      await sendMail({
        to: decoded.email,
        subject: 'Phone verification code',
        html: `<p>Your phone verification code for <strong>${phone}</strong> is <strong>${code}</strong>.</p><p>Expires ${expiresAt.toISOString()}.</p>`,
        fromType: 'transactional',
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      deliveredVia,
      message: deliveredVia === 'sms'
        ? 'SMS code sent'
        : 'Verification code sent to your email (SMS not configured)',
    });
  } catch (error) {
    console.error('[phone-verify]', error);
    return NextResponse.json({ error: 'Could not send phone code' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const decoded = await requireUser(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const phone = normalizePhone(body.phone);
    const result = await verifyOtp(phone, 'phone_verify', body.code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const sec = await getOrCreateSecurity(decoded.uid, 'uid');
    sec.phoneVerifiedAt = new Date();
    sec.phoneE164 = phone;
    await sec.save();

    await connectDB();
    await User.findByIdAndUpdate(decoded.uid, { phone }, { upsert: false });

    return NextResponse.json({ ok: true, phoneVerified: true, phone });
  } catch (error) {
    console.error('[phone-verify confirm]', error);
    return NextResponse.json({ error: 'Could not verify phone' }, { status: 500 });
  }
}
