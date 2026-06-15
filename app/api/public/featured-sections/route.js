import dbConnect from '@/lib/mongodb';
import CategorySlider from '@/models/CategorySlider';
import { NextResponse } from 'next/server';
import { getCachedData, setCachedData } from '@/lib/cache';

const CACHE_KEY = 'public:featured-sections:v1';

export async function GET(req) {
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
      .select('title titleAr subtitle subtitleAr productIds storeId sortOrder isActive layout sectionType category tag')
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    const payload = { sections: sections || [] };
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
