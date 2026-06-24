import { NextResponse } from 'next/server';
import { getProductPageData } from '@/lib/productPageData';
import { resolveStorefrontLanguage } from '@/lib/storefrontLanguage';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = String(searchParams.get('slug') || '').trim();
    const requestedLanguage = searchParams.get('lang');
    const language = requestedLanguage === 'ar' || requestedLanguage === 'en'
      ? requestedLanguage
      : resolveStorefrontLanguage(request);

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    const payload = await getProductPageData(slug, language);

    if (!payload?.product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': isDev ? 'no-store' : 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[api/products/page] error:', error);
    return NextResponse.json({ error: 'Failed to load product page' }, { status: 500 });
  }
}
