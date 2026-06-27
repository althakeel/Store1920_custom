import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';
import { generateCacheKey, getCachedData, setCachedData } from '@/lib/cache';
import { resolveStorefrontLanguage } from '@/lib/storefrontLanguage';
import {
  OFFERS_MIN_DISCOUNT_PERCENT,
  OFFERS_PAGE_SIZE,
  fetchOffersProducts,
  normalizeOfferProduct,
} from '@/lib/offersCatalog';

export async function GET(request) {
  const language = resolveStorefrontLanguage(request);
  const { searchParams } = new URL(request.url);
  const parsedPage = parseInt(searchParams.get('page') || '1', 10);
  const parsedLimit = parseInt(searchParams.get('limit') || String(OFFERS_PAGE_SIZE), 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 48) : OFFERS_PAGE_SIZE;

  const cacheKey = generateCacheKey('public:offers', {
    page,
    limit,
    minDiscount: OFFERS_MIN_DISCOUNT_PERCENT,
    language,
  });

  const cached = getCachedData(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Cache': 'HIT',
      },
    });
  }

  try {
    await dbConnect();

    const result = await fetchOffersProducts(Product, { page, limit });
    const payload = {
      products: result.products.map((product) => normalizeOfferProduct(product, language)),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
      minDiscountPercent: OFFERS_MIN_DISCOUNT_PERCENT,
    };

    setCachedData(cacheKey, payload, 300);

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('[public/offers] fetch failed:', error);
    return NextResponse.json(
      {
        products: [],
        pagination: { page: 1, limit, total: 0, totalPages: 1 },
        minDiscountPercent: OFFERS_MIN_DISCOUNT_PERCENT,
      },
      { status: 500 },
    );
  }
}
