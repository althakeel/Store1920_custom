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

export async function GET(request, { params }) {
  try {
    const auth = await requireSeller(request);
    if (auth.error) return auth.error;

    const { blogId } = await params;
    if (!blogId || !mongoose.Types.ObjectId.isValid(blogId)) {
      return NextResponse.json({ error: 'Invalid blog id' }, { status: 400 });
    }

    await connectDB();
    const blog = await Blog.findOne({
      _id: blogId,
      storeId: resolveStoreObjectId(auth.storeId),
    }).lean();

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, blog: toStoreBlog(blog) });
  } catch (error) {
    console.error('[store/blogs/:id GET]', error);
    return NextResponse.json({ error: 'Failed to load blog' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const auth = await requireSeller(request);
    if (auth.error) return auth.error;

    const { blogId } = await params;
    if (!blogId || !mongoose.Types.ObjectId.isValid(blogId)) {
      return NextResponse.json({ error: 'Invalid blog id' }, { status: 400 });
    }

    const body = await request.json();
    const title = String(body?.title || '').trim();
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    await connectDB();
    const storeObjectId = resolveStoreObjectId(auth.storeId);
    const existing = await Blog.findOne({ _id: blogId, storeId: storeObjectId });
    if (!existing) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    const desiredSlug = body?.slug
      ? slugifyBlogTitle(body.slug)
      : existing.slug || slugifyBlogTitle(title);
    const slug = await ensureUniqueBlogSlug(Blog, storeObjectId, desiredSlug, existing._id);
    const status = body?.status === 'published' ? 'published' : 'draft';
    let publishedAt = existing.publishedAt;
    if (body?.publishedAt) {
      const parsed = new Date(body.publishedAt);
      if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
    } else if (status === 'published' && !publishedAt) {
      publishedAt = new Date();
    }
    if (status === 'draft' && body?.clearPublishedAt) {
      publishedAt = null;
    }

    existing.title = title;
    existing.titleAr = String(body?.titleAr || '').trim();
    existing.slug = slug;
    existing.excerpt = String(body?.excerpt || '').trim();
    existing.excerptAr = String(body?.excerptAr || '').trim();
    existing.contentHtml = sanitizeBlogHtml(body?.contentHtml || '');
    existing.contentHtmlAr = sanitizeBlogHtml(body?.contentHtmlAr || '');
    existing.coverImage = String(body?.coverImage || '').trim();
    existing.status = status;
    existing.publishedAt = publishedAt;
    existing.seoTitle = String(body?.seoTitle || '').trim();
    existing.seoDescription = String(body?.seoDescription || '').trim();
    existing.authorName = String(body?.authorName || '').trim();
    await existing.save();

    invalidatePublicBlogCache();

    return NextResponse.json({ success: true, blog: toStoreBlog(existing.toObject()) });
  } catch (error) {
    console.error('[store/blogs/:id PUT]', error);
    if (error?.code === 11000) {
      return NextResponse.json({ error: 'A blog with this slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update blog' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await requireSeller(request);
    if (auth.error) return auth.error;

    const { blogId } = await params;
    if (!blogId || !mongoose.Types.ObjectId.isValid(blogId)) {
      return NextResponse.json({ error: 'Invalid blog id' }, { status: 400 });
    }

    await connectDB();
    const deleted = await Blog.findOneAndDelete({
      _id: blogId,
      storeId: resolveStoreObjectId(auth.storeId),
    }).lean();

    if (!deleted) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    invalidatePublicBlogCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[store/blogs/:id DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete blog' }, { status: 500 });
  }
}
