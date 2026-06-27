import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { isConfirmedPaidOrder } from '@/lib/orderConfirmationPolicy';
import { sendPaidOrderConfirmationNotifications } from '@/lib/orderConfirmationNotifications';

export const dynamic = 'force-dynamic';

/**
 * Idempotent fallback when payment webhooks are delayed or misconfigured.
 * Called from order-success after Stripe/Tamara/Tabby redirect.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.orderId || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    await connectDB();
    const order = await Order.findById(orderId).lean();
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!isConfirmedPaidOrder(order)) {
      return NextResponse.json({ skipped: true, reason: 'order_not_paid' });
    }

    const result = await sendPaidOrderConfirmationNotifications(orderId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[orders/confirm-paid]', error);
    return NextResponse.json({ error: error?.message || 'Failed to send confirmations' }, { status: 500 });
  }
}
