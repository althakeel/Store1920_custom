import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import authSeller from '@/middlewares/authSeller';
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import { importProductFromUrl } from '@/lib/importProductFromUrl';
import { runInProductAiQueue } from '@/lib/aiRequestQueue';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function getUserId(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const decoded = await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
    return decoded.uid || null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found for user' }, { status: 403 });
    }

    const body = await request.json();
    const url = String(body?.url || '').trim();
    const enhanceImages = body?.enhanceImages !== false;
    if (!url) {
      return NextResponse.json({ error: 'Product URL is required' }, { status: 400 });
    }

    await connectDB();
    const storeCategories = await Category.find({}).select('_id name').sort({ name: 1 }).lean();

    const result = await runInProductAiQueue(() => importProductFromUrl(url, { enhanceImages, storeCategories }));
    return NextResponse.json(result);
  } catch (error) {
    console.error('[product/import-from-url POST]', error);
    const message = error?.message || 'Failed to import product from URL';
    const status = /not authorized|forbidden|not allowed|valid product url|valid url/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
