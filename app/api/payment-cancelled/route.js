import { NextResponse } from 'next/server';
import { handlePaymentCancellationRecovery } from '@/lib/paymentCancellationRecovery';

export async function POST(request) {
  try {
    const body = await request.json();
    const orderId = String(body?.orderId || '').trim();
    const reason = String(body?.reason || 'Payment was not completed').trim();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const result = await handlePaymentCancellationRecovery({ orderId, reason });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('[payment-cancelled] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process cancellation' }, { status: 500 });
  }
}
