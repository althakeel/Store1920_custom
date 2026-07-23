import { NextResponse } from 'next/server';
import { verifyStoreSeller } from '@/lib/storeSellerAuth';
import { paymentSecurityPublicConfig } from '@/lib/paymentSecurity';
import { listPaymentLogs } from '@/lib/paymentTransactionLog';
import { listRefundAuthorizations } from '@/lib/paymentRefundAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await verifyStoreSeller(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'overview';

  if (view === 'logs') {
    const result = await listPaymentLogs({
      storeId: auth.storeId,
      orderId: searchParams.get('orderId') || '',
      eventType: searchParams.get('eventType') || '',
      provider: searchParams.get('provider') || '',
      limit: searchParams.get('limit') || 50,
      skip: searchParams.get('skip') || 0,
    });
    // Also include logs without storeId but matching orderId for legacy
    return NextResponse.json({ ok: true, ...result });
  }

  if (view === 'refunds') {
    const refunds = await listRefundAuthorizations({
      storeId: auth.storeId,
      status: searchParams.get('status') || '',
    });
    return NextResponse.json({ ok: true, refunds });
  }

  return NextResponse.json({
    ok: true,
    config: paymentSecurityPublicConfig(),
    storeId: auth.storeId,
  });
}
