import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyStripeOrderPayment } from '@/lib/stripeOrderPayment';
import Order from '@/models/Order';
import { getAuth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/** Fallback when Stripe webhooks are delayed or misconfigured. Called from order-success redirect. */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.orderId || '').trim();
    const sessionId = String(body?.sessionId || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    await connectDB();
    const order = await Order.findById(orderId).select('userId stripeCheckoutSessionId').lean();
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const authorization = request.headers.get('authorization') || '';
    let ownsOrder = false;
    if (authorization) {
      if (!authorization.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Invalid authorization header' }, { status: 401 });
      }
      try {
        const decoded = await getAuth().verifyIdToken(authorization.slice(7));
        ownsOrder = Boolean(order.userId) && String(order.userId) === String(decoded.uid);
      } catch {
        return NextResponse.json({ error: 'Invalid or expired authentication' }, { status: 401 });
      }
    }

    const ownsSessionCapability = Boolean(sessionId)
      && String(order.stripeCheckoutSessionId || '').trim() === sessionId;
    if (!ownsOrder && !ownsSessionCapability) {
      return NextResponse.json({ error: 'Payment verification is not authorized' }, { status: 403 });
    }

    const result = await verifyStripeOrderPayment(orderId, {
      expectedSessionId: ownsSessionCapability ? sessionId : '',
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[orders/verify-stripe]', error);
    return NextResponse.json({ error: error?.message || 'Failed to verify Stripe payment' }, { status: 500 });
  }
}
