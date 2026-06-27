import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import { sendLoginAlertEmail } from '@/lib/email';

export async function POST(req) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = getAuth();
    await auth.verifyIdToken(token);

    const { email, name } = await req.json();

    const result = await sendLoginAlertEmail({
      email,
      name,
      loginTime: new Date(),
    });

    return NextResponse.json({ success: true, emailId: result?.messageId || result?.id || null });
  } catch (error) {
    console.error('Send login email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
