import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';

export const dynamic = 'force-dynamic';

/**
 * Creates a Stripe Checkout session so a customer can pay online (with 5% off)
 * for an already-placed COD order (the order-success "PAY NOW" upsell).
 *
 * The base order is left as COD/unpaid; the discount and paid status are only
 * applied when Stripe confirms payment (webhook or verify fallback), so an
 * abandoned payment keeps the original COD order intact.
 */
export async function POST(request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.orderId || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    await dbConnect();
    const order = await Order.findById(orderId).lean();
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.isPaid === true || String(order.paymentStatus || '').toUpperCase() === 'PAID') {
      return NextResponse.json({ error: 'Order is already paid' }, { status: 409 });
    }

    const baseTotal = Number(order.total || 0);
    if (!(baseTotal > 0)) {
      return NextResponse.json({ error: 'Order total is not payable' }, { status: 400 });
    }

    const discountedTotal = Number((baseTotal * 0.95).toFixed(2));
    const origin = request.headers.get('origin')
      || process.env.NEXT_PUBLIC_BASE_URL
      || 'https://store1920.com';

    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'AED',
          product_data: { name: 'Order Payment (5% prepaid discount)' },
          unit_amount: Math.round(discountedTotal * 100),
        },
        quantity: 1,
      }],
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      mode: 'payment',
      success_url: `${origin}/order-success?orderId=${orderId}&stripe=1&prepaid=1`,
      cancel_url: `${origin}/order-success?orderId=${orderId}`,
      metadata: {
        orderIds: orderId,
        userId: order.userId || '',
        prepaidUpsell: '1',
        discountedTotal: String(discountedTotal),
      },
    });

    await Order.findByIdAndUpdate(orderId, {
      $set: { stripeCheckoutSessionId: session.id },
    }).catch((err) => {
      console.error('[prepaid-upsell] Failed to save Stripe session id:', err?.message || err);
    });

    return NextResponse.json({ success: true, url: session.url, orderId });
  } catch (error) {
    console.error('[prepaid-upsell] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create payment session' }, { status: 500 });
  }
}
