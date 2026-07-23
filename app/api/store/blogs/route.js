import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Blog from '@/models/Blog';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import {
  ensureUniqueBlogSlug,
  sanitizeBlogHtml,
  slugifyBlogTitle,
  toStoreBlog,
} from '@/lib/blogHelpers';
import { invalidateCachePattern } from '@/lib/cache';

function invalidatePublicBlogCache() {
  invalidateCachePattern('public:blogs:');
}

function resolveStoreObjectId(storeId) {
  const value = String(storeId || '').trim();
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return value;
  return new mongoose.Types.ObjectId(value);
}

async function requireSeller(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  let userId;
  try {
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    userId = decoded.uid;
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const storeId = await authSeller(userId);
  if (!storeId) {
    return { error: NextResponse.json({ error: 'Not authorized as seller' }, { status: 403 }) };
  }

  return { storeId };
}

export async function GET(request) {
  try {
    const auth = await requireSeller(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const status = String(searchParams.get('status') || '').trim();
    const q = String(searchParams.get('q') || '').trim();

    await connectDB();
    const storeObjectId = resolveStoreObjectId(auth.storeId);
    const filter = { storeId: storeObjectId };
    if (status === 'draft' || status === 'published') filter.status = status;
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { titleAr: { $regex: q, $options: 'i' } },
        { slug: { $regex: q, $options: 'i' } },
      ];
    }

    const blogs = await Blog.find(filter)
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      blogs: blogs.map(toStoreBlog),
    });
  } catch (error) {
    console.error('[store/blogs GET]', error);
    return NextResponse.json({ error: 'Failed to load blogs' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireSeller(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const title = String(body?.title || '').trim();
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    await connectDB();
    const storeObjectId = resolveStoreObjectId(auth.storeId);
    const desiredSlug = body?.slug ? slugifyBlogTitle(body.slug) : slugifyBlogTitle(title);
    const slug = await ensureUniqueBlogSlug(Blog, storeObjectId, desiredSlug);
    const status = body?.status === 'published' ? 'published' : 'draft';
    let publishedAt = null;
    if (body?.publishedAt) {
      const parsed = new Date(body.publishedAt);
      if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
    } else if (status === 'published') {
      publishedAt = new Date();
    }

    const blog = await Blog.create({
      storeId: storeObjectId,
      title,
      titleAr: String(body?.titleAr || '').trim(),
      slug,
      excerpt: String(body?.excerpt || '').trim(),
      excerptAr: String(body?.excerptAr || '').trim(),
      contentHtml: sanitizeBlogHtml(body?.contentHtml || ''),
      contentHtmlAr: sanitizeBlogHtml(body?.contentHtmlAr || ''),
      coverImage: String(body?.coverImage || '').trim(),
      status,
      publishedAt,
      seoTitle: String(body?.seoTitle || '').trim(),
      seoDescription: String(body?.seoDescription || '').trim(),
      authorName: String(body?.authorName || '').trim(),
    });

    invalidatePublicBlogCache();

    return NextResponse.json({ success: true, blog: toStoreBlog(blog.toObject()) }, { status: 201 });
  } catch (error) {
    console.error('[store/blogs POST]', error);
    if (error?.code === 11000) {
      return NextResponse.json({ error: 'A blog with this slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create blog' }, { status: 500 });
  }
}
