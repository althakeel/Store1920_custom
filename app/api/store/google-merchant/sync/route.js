import { NextResponse } from 'next/server';
import { verifyStoreSeller } from '@/lib/storeSellerAuth';
import { syncProductsToGoogleMerchant } from '@/lib/googleMerchant/sync';
import { assertGoogleMerchantConfigured } from '@/lib/googleMerchant/config';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const auth = await verifyStoreSeller(request);
    if (auth.error) return auth.error;

    assertGoogleMerchantConfigured();

    const body = await request.json().catch(() => ({}));
    const limit = Number(body?.limit || 200);
    const inStockOnly = body?.inStockOnly !== false;
    const dryRun = body?.dryRun === true;

    const summary = await syncProductsToGoogleMerchant({
      storeId: auth.storeId,
      limit,
      inStockOnly,
      dryRun,
    });

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('[store/google-merchant/sync]', error);
    return NextResponse.json({ error: error?.message || 'Google Merchant sync failed' }, { status: 500 });
  }
}
