import { NextResponse } from 'next/server';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { generateCategoryImage } from '@/lib/categoryImageAi';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.replace('Bearer ', '');
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const storeId = await authSeller(decodedToken.uid);

    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const { categoryName } = await request.json();
    const result = await generateCategoryImage(categoryName);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[category-generate-image]', error);

    const status = Number(error?.status || error?.response?.status || 500);
    const safeStatus = Number.isFinite(status) && status >= 400 ? status : 500;
    const message = String(error?.message || 'Failed to generate category image').trim();

    return NextResponse.json({ error: message }, { status: safeStatus });
  }
}
