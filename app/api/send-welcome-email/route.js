import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import { sendWelcomeEmail } from '@/lib/email';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      return NextResponse.json({ error: 'Invalid authorization header' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    await User.findOneAndUpdate(
      { _id: userId },
      {
        $setOnInsert: {
          _id: userId,
          email,
          name: name || '',
          image: '',
          cart: [],
        },
      },
      { upsert: true, new: true },
    );

    await sendWelcomeEmail(email, name);

    return NextResponse.json({
      success: true,
      message: 'Welcome email sent successfully',
    });
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return NextResponse.json({
      error: 'Failed to send welcome email',
      details: error.message,
    }, { status: 500 });
  }
}
