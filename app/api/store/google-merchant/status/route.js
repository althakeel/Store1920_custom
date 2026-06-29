import { NextResponse } from 'next/server';
import { getCustomerSiteUrl } from '@/lib/appUrl';
import { verifyStoreSeller } from '@/lib/storeSellerAuth';
import { getGoogleMerchantConfig } from '@/lib/googleMerchant/config';
import { listGoogleMerchantDataSources } from '@/lib/googleMerchant/client';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = await verifyStoreSeller(request);
    if (auth.error) return auth.error;

    const config = getGoogleMerchantConfig();
    const baseUrl = getCustomerSiteUrl();

    let dataSources = [];
    if (config.configured) {
      try {
        dataSources = await listGoogleMerchantDataSources();
      } catch (error) {
        dataSources = [{ error: error?.message || 'Failed to list data sources' }];
      }
    }

    return NextResponse.json({
      configured: config.configured,
      accountId: config.accountId || null,
      dataSource: config.dataSource || null,
      contentLanguage: config.contentLanguage,
      feedLabels: config.feedLabels,
      feedUrl: `${baseUrl}/api/feeds/google-merchant`,
      syncUrl: `${baseUrl}/api/store/google-merchant/sync`,
      dataSources,
    });
  } catch (error) {
    console.error('[store/google-merchant/status]', error);
    return NextResponse.json({ error: error?.message || 'Failed to load Google Merchant status' }, { status: 500 });
  }
}
