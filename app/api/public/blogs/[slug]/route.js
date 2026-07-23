import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Blog from '@/models/Blog';
import Store from '@/models/Store';
import Product from '@/models/Product';
import { resolvePublicFeaturedStore } from '@/lib/featuredProducts';
import { toPublicBlog } from '@/lib/blogHelpers';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { slug: rawSlug } = await params;
    const slug = String(rawSlug || '').trim().toLowerCase();
    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const language = String(searchParams.get('lang') || searchParams.get('language') || 'en').toLowerCase() === 'ar'
      ? 'ar'
      : 'en';
    const storeIdParam = String(searchParams.get('storeId') || '').trim();

    await connectDB();
    let storeId = storeIdParam;
    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      const store = await resolvePublicFeaturedStore(Store, Product);
      storeId = store?._id ? String(store._id) : null;
    }

    if (!storeId) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    const now = new Date();
    const blog = await Blog.findOne({
      storeId,
      slug,
      status: 'published',
      $or: [
        { publishedAt: { $lte: now } },
        { publishedAt: null },
      ],
    }).lean();

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    const publishedAt = blog.publishedAt || blog.createdAt || now;

    const [previous, next, recent] = await Promise.all([
      // Previous = older post (published before this one)
      Blog.findOne({
        storeId,
        status: 'published',
        $or: [
          { publishedAt: { $lt: publishedAt, $lte: now } },
          { publishedAt: null, createdAt: { $lt: publishedAt } },
        ],
        _id: { $ne: blog._id },
      })
        .sort({ publishedAt: -1, createdAt: -1 })
        .select('title titleAr slug coverImage publishedAt')
        .lean(),
      // Next = newer post
      Blog.findOne({
        storeId,
        status: 'published',
        publishedAt: { $gt: publishedAt, $lte: now },
        _id: { $ne: blog._id },
      })
        .sort({ publishedAt: 1, createdAt: 1 })
        .select('title titleAr slug coverImage publishedAt')
        .lean(),
      Blog.find({
        storeId,
        status: 'published',
        _id: { $ne: blog._id },
        $or: [
          { publishedAt: { $lte: now } },
          { publishedAt: null },
        ],
      })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(6)
        .select('title titleAr slug coverImage publishedAt excerpt excerptAr')
        .lean(),
    ]);

    const mapNav = (doc) => (doc ? toPublicBlog(doc, { language }) : null);

    return NextResponse.json({
      success: true,
      blog: toPublicBlog(blog, { language }),
      previous: mapNav(previous),
      next: mapNav(next),
      recent: recent.map((doc) => toPublicBlog(doc, { language })),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('[public/blogs/:slug GET]', error);
    return NextResponse.json({ error: 'Failed to load blog' }, { status: 500 });
  }
}
