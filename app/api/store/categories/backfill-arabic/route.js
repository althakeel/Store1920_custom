import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { invalidateCategoryCaches } from '@/lib/categoryCache';
import { cleanDisplayText } from '@/lib/displayText';
import { getCanonicalUaeArabicCategoryName, getSlugBasedUaeArabicCategoryName } from '@/lib/categoryLocalization';

async function verifyStoreSeller(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const idToken = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const storeId = await authSeller(decodedToken.uid);
  if (!storeId) {
    return { error: NextResponse.json({ error: 'Not authorized' }, { status: 401 }) };
  }

  return { userId: decodedToken.uid };
}

export async function POST(request) {
  try {
    await connectDB();

    const auth = await verifyStoreSeller(request);
    if (auth.error) return auth.error;

    const categories = await Category.find({ isActive: { $ne: false } })
      .select('_id name nameAr slug')
      .lean();

    let updated = 0;

    for (const category of categories) {
      const suggested = getCanonicalUaeArabicCategoryName(category);
      if (!suggested) continue;

      const stored = cleanDisplayText(category.nameAr || '');
      const slugArabic = cleanDisplayText(getSlugBasedUaeArabicCategoryName(category.slug));
      const shouldUpdate = !stored || (slugArabic && stored !== slugArabic);
      if (!shouldUpdate) continue;

      await Category.findByIdAndUpdate(category._id, {
        $set: { nameAr: cleanDisplayText(suggested) },
      });
      updated += 1;
    }

    invalidateCategoryCaches();

    return NextResponse.json({
      message: 'Arabic category names updated',
      updated,
      total: categories.length,
    });
  } catch (error) {
    console.error('[categories/backfill-arabic POST]', error);
    return NextResponse.json({ error: 'Failed to backfill Arabic category names' }, { status: 500 });
  }
}
