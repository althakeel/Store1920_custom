import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyStripeOrderPayment } from '@/lib/stripeOrderPayment';

export const dynamic = 'force-dynamic';

/** Fallback when Stripe webhooks are delayed or misconfigured. Called from order-success redirect. */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.orderId || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    await connectDB();
    const result = await verifyStripeOrderPayment(orderId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[orders/verify-stripe]', error);
    return NextResponse.json({ error: error?.message || 'Failed to verify Stripe payment' }, { status: 500 });
  }
}
