import { NextResponse } from 'next/server';
import { getCustomerSiteUrl } from '@/lib/appUrl';
import { getGoogleMerchantConfig } from '@/lib/googleMerchant/config';
import { buildGoogleMerchantFeedXml } from '@/lib/googleMerchant/feedXml';
import { mapProductToFeedItem } from '@/lib/googleMerchant/mapProduct';
import { fetchGoogleMerchantCatalogProducts } from '@/lib/googleMerchant/products';

export const dynamic = 'force-dynamic';

function isAuthorizedFeedRequest(request) {
  const { feedToken } = getGoogleMerchantConfig();
  if (!feedToken) return true;

  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token') || '';
  const headerToken = request.headers.get('x-feed-token') || '';
  return queryToken === feedToken || headerToken === feedToken;
}

export async function GET(request) {
  try {
    if (!isAuthorizedFeedRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized feed access' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') || 5000);
    const inStockOnly = url.searchParams.get('inStockOnly') !== '0';
    const config = getGoogleMerchantConfig();

    const products = await fetchGoogleMerchantCatalogProducts({ limit, inStockOnly });
    const baseUrl = getCustomerSiteUrl();
    const items = products
      .map((product) => mapProductToFeedItem(product, {
        baseUrl,
        defaultCategory: config.defaultCategory,
      }))
      .filter(Boolean);

    const xml = buildGoogleMerchantFeedXml(items, {
      title: 'Store1920 Products',
      link: baseUrl,
      description: 'Store1920 product feed for Google Merchant Center',
    });

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
      },
    });
  } catch (error) {
    console.error('[feeds/google-merchant]', error);
    return NextResponse.json({ error: error?.message || 'Failed to build Google Merchant feed' }, { status: 500 });
  }
}
