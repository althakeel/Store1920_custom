import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyStoreSeller } from '@/lib/storeSellerAuth';
import { reconcileStoreOrderPayments } from '@/lib/orderPaymentReconciliation';

export const dynamic = 'force-dynamic';

/** Re-check last 24h online payments against Stripe/Tabby/Tamara/Razorpay. */
export async function POST(request) {
  try {
    const auth = await verifyStoreSeller(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const hours = Number(body?.hours || 24);

    await connectDB();
    const summary = await reconcileStoreOrderPayments(auth.storeId, { hours });

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('[store/orders/reconcile-payments]', error);
    return NextResponse.json(
      { error: error?.message || 'Payment reconciliation failed' },
      { status: 500 },
    );
  }
}
