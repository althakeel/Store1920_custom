import dbConnect from '@/lib/mongodb';
import CategorySlider from '@/models/CategorySlider';
import { getCachedData, setCachedData } from '@/lib/cache';
import { NextResponse } from 'next/server';

const CACHE_KEY = 'public:category-sliders:v1';
const CACHE_TTL = 120;

export async function GET() {
  try {
    const cached = getCachedData(CACHE_KEY);
    if (cached) {
      return NextResponse.json(
        { sliders: cached },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
            'X-Cache': 'HIT',
          },
        }
      );
    }

    await dbConnect();

    const sliders = await CategorySlider.find({})
      .select('title subtitle productIds storeId createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    setCachedData(CACHE_KEY, sliders, CACHE_TTL);

    return NextResponse.json(
      { sliders: sliders || [] },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
          'X-Cache': 'MISS',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching public category sliders:', error);
    return NextResponse.json({ sliders: [] }, { status: 200 });
  }
}
