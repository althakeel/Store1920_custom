import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import dbConnect from '@/lib/mongodb';
import { finalizeAbandonedCartFromStripeSession } from '@/lib/abandonedCartConversion';

export async function POST(request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
    }

    const body = await request.json();
    const sessionId = String(body?.sessionId || '').trim();
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    await dbConnect();
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const updatedCart = await finalizeAbandonedCartFromStripeSession(session);

    if (!updatedCart) {
      if (session?.metadata?.type === 'abandoned_cart_recovery' && session.payment_status !== 'paid') {
        return NextResponse.json({ error: 'Payment is not completed yet' }, { status: 402 });
      }
      return NextResponse.json({ error: 'Recovery payment could not be confirmed' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      cartId: String(updatedCart._id),
      convertedAt: updatedCart.convertedAt,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to confirm payment' }, { status: 500 });
  }
}
