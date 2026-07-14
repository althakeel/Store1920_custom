import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { reconcileFailedOnlinePaymentsForAllStores } from '@/lib/orderPaymentReconciliation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Vercel cron: re-check Tabby / Tamara / Stripe / card orders that may be
 * paid at the provider but still AWAITING_PAYMENT or PAYMENT_FAILED in Mongo.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(request) {
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  const authorization = request.headers.get('authorization') || '';
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const summary = await reconcileFailedOnlinePaymentsForAllStores({
      hours: 72,
      limitPerStore: 60,
      maxStores: 20,
    });
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('[cron/reconcile-payments]', error);
    return NextResponse.json(
      { error: error?.message || 'Payment reconciliation cron failed' },
      { status: 500 },
    );
  }
}
