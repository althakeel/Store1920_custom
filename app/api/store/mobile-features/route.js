import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import StorePreference from '@/models/StorePreference';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { deleteCacheKey, invalidateCachePattern } from '@/lib/cache';
import {
  DEFAULT_MOBILE_FEATURES,
  MOBILE_FEATURES_CACHE_KEY,
  mergeMobileFeaturesUpdate,
  normalizeMobileFeatures,
} from '@/lib/mobileFeatures';

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

function invalidateMobileFeaturesCache() {
  deleteCacheKey(MOBILE_FEATURES_CACHE_KEY);
  invalidateCachePattern(`${MOBILE_FEATURES_CACHE_KEY}:`);
  try {
    revalidatePath('/');
  } catch {
    // Safe outside Next request context.
  }
}

export async function GET(request) {
  try {
    const auth = await requireSeller(request);
    if (auth.error) return auth.error;

    await connectDB();
    const storeObjectId = resolveStoreObjectId(auth.storeId);
    const pref = await StorePreference.findOne({ storeId: storeObjectId })
      .select('mobileFeatures')
      .lean();

    return NextResponse.json({
      success: true,
      mobileFeatures: normalizeMobileFeatures(pref?.mobileFeatures || DEFAULT_MOBILE_FEATURES),
    });
  } catch (error) {
    console.error('[store/mobile-features GET]', error);
    return NextResponse.json({ error: 'Failed to load mobile features' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = await requireSeller(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    await connectDB();
    const storeObjectId = resolveStoreObjectId(auth.storeId);
    const existing = await StorePreference.findOne({ storeId: storeObjectId })
      .select('mobileFeatures')
      .lean();

    const mobileFeatures = mergeMobileFeaturesUpdate(
      existing?.mobileFeatures || {},
      body?.mobileFeatures || body || {},
    );

    const updated = await StorePreference.findOneAndUpdate(
      { storeId: storeObjectId },
      { $set: { mobileFeatures } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
      .select('mobileFeatures')
      .lean();

    invalidateMobileFeaturesCache();

    return NextResponse.json({
      success: true,
      mobileFeatures: normalizeMobileFeatures(updated?.mobileFeatures || mobileFeatures),
    });
  } catch (error) {
    console.error('[store/mobile-features PUT]', error);
    return NextResponse.json({ error: 'Failed to save mobile features' }, { status: 500 });
  }
}
