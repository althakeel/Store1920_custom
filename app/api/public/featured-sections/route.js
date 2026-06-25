import dbConnect from '@/lib/mongodb';
import CategorySlider from '@/models/CategorySlider';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';
import { getCachedData, setCachedData } from '@/lib/cache';
import { FEATURED_SECTIONS_CACHE_KEY } from '@/lib/categorySliderCache';
import { normalizeCategorySliderBackground } from '@/lib/categorySliderTheme';
import mongoose from 'mongoose';

const CACHE_KEY = FEATURED_SECTIONS_CACHE_KEY;

function orderProductsByIds(products, ids) {
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  return ids
    .map((id) => productMap.get(String(id)))
    .filter(Boolean);
}

export async function GET() {
  try {
    const cached = getCachedData(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
          'X-Cache': 'HIT',
        },
      });
    }

    await dbConnect();

    const sections = await CategorySlider.find({})
      .select('title subtitle sideImage cardsPerRow backgroundColor productIds storeId createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    const allProductIds = [
      ...new Set(
        sections
          .flatMap((section) => (Array.isArray(section.productIds) ? section.productIds : []))
          .map((id) => String(id || '').trim())
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
      ),
    ];

    const products = allProductIds.length
      ? await Product.find({ _id: { $in: allProductIds } })
          .select('name nameAr slug price mrp AED images category inStock stockQuantity fastDelivery freeShippingEligible useProductsPath imageAspectRatio averageRating ratingCount')
          .lean()
      : [];

    const payload = {
      sections: sections.map((section) => {
        const productIds = Array.isArray(section.productIds) ? section.productIds : [];
        return {
          ...section,
          cardsPerRow: section.cardsPerRow === 5 ? 5 : 6,
          backgroundColor: normalizeCategorySliderBackground(section.backgroundColor),
          products: orderProductsByIds(products, productIds),
        };
      }),
    };

    setCachedData(CACHE_KEY, payload, 120);

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Error fetching featured sections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sections' },
      { status: 500 }
    );
  }
}
