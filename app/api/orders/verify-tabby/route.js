import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyTabbyOrderPayment } from '@/lib/tabbyOrderPayment';

export const dynamic = 'force-dynamic';

/** Fallback when Tabby webhooks are delayed or misconfigured. Called from order-success redirect. */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.orderId || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    await connectDB();
    const result = await verifyTabbyOrderPayment(orderId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[orders/verify-tabby]', error);
    return NextResponse.json({ error: error?.message || 'Failed to verify Tabby payment' }, { status: 500 });
  }
}
