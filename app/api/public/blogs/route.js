import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Blog from '@/models/Blog';
import Store from '@/models/Store';
import Product from '@/models/Product';
import { getCachedData, setCachedData } from '@/lib/cache';
import { resolvePublicFeaturedStore } from '@/lib/featuredProducts';
import { toPublicBlog } from '@/lib/blogHelpers';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

async function resolveStoreId(storeIdQuery) {
  const queried = String(storeIdQuery || '').trim();
  if (queried && mongoose.Types.ObjectId.isValid(queried)) return queried;

  const store = await resolvePublicFeaturedStore(Store, Product);
  return store?._id ? String(store._id) : null;
}

function resolveSort(sortParam) {
  const sort = String(sortParam || 'newest').toLowerCase();
  if (sort === 'oldest') return { publishedAt: 1, createdAt: 1 };
  if (sort === 'title') return { title: 1 };
  return { publishedAt: -1, createdAt: -1 };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeIdParam = searchParams.get('storeId');
    const language = String(searchParams.get('lang') || searchParams.get('language') || 'en').toLowerCase() === 'ar'
      ? 'ar'
      : 'en';
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const sortKey = String(searchParams.get('sort') || 'newest').toLowerCase();
    const q = String(searchParams.get('q') || '').trim();

    await connectDB();
    const storeId = await resolveStoreId(storeIdParam);
    if (!storeId) {
      return NextResponse.json({ success: true, blogs: [], total: 0, page, limit, sort: sortKey });
    }

    const cacheKey = `public:blogs:v2:${storeId}:${language}:${page}:${limit}:${sortKey}:${q}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      });
    }

    const now = new Date();
    const andClauses = [
      { storeId },
      { status: 'published' },
      {
        $or: [
          { publishedAt: { $lte: now } },
          { publishedAt: null },
        ],
      },
    ];

    if (q) {
      andClauses.push({
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { titleAr: { $regex: q, $options: 'i' } },
          { excerpt: { $regex: q, $options: 'i' } },
          { excerptAr: { $regex: q, $options: 'i' } },
        ],
      });
    }

    const filter = { $and: andClauses };

    const [total, blogs] = await Promise.all([
      Blog.countDocuments(filter),
      Blog.find(filter)
        .sort(resolveSort(sortKey))
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const payload = {
      success: true,
      storeId,
      page,
      limit,
      total,
      sort: sortKey,
      q,
      blogs: blogs.map((doc) => toPublicBlog(doc, { language })),
    };

    setCachedData(cacheKey, payload, 60);
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('[public/blogs GET]', error);
    return NextResponse.json({ success: true, blogs: [], total: 0 }, { status: 200 });
  }
}
