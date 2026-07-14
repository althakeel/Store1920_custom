import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyTamaraOrderPayment } from '@/lib/tamaraOrderPayment';

export const dynamic = 'force-dynamic';

/** Fallback when Tamara webhooks are delayed. Called from order-success redirect. */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.orderId || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    await connectDB();
    const result = await verifyTamaraOrderPayment(orderId, { source: 'tamara_order_success_verify' });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[orders/verify-tamara]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to verify Tamara payment' },
      { status: 500 },
    );
  }
}
