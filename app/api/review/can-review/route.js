import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Rating from '@/models/Rating';
import { getAuth } from '@/lib/firebase-admin';
import { getReviewEligibility } from '@/lib/reviewEligibility';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = String(searchParams.get('productId') || '').trim();

    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ canReview: false, signedIn: false });
    }

    let userId = null;
    let userEmail = '';
    try {
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
      userId = decoded.uid;
      userEmail = decoded.email || '';
    } catch {
      return NextResponse.json({ canReview: false, signedIn: false });
    }

    await connectDB();

    const eligibility = await getReviewEligibility({
      Order,
      Rating,
      userId,
      productId,
      userEmail,
    });

    return NextResponse.json(eligibility);
  } catch (error) {
    console.error('[review/can-review GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to check review eligibility' }, { status: 500 });
  }
}
