import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import StorePreference from '@/models/StorePreference';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { deleteCacheKey, getCachedData, invalidateCachePattern, setCachedData } from '@/lib/cache';
import {
  MOBILE_FEATURES_CACHE_KEY,
  getSectionPublicPayload,
  mergeSectionIntoMobileFeatures,
  normalizeMobileFeatures,
} from '@/lib/mobileFeatures';
import { normalizeBannerSection } from '@/lib/mobileBannerLayout';

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
    // ignore
  }
}

async function loadStorePreference(storeId) {
  await connectDB();
  const storeObjectId = resolveStoreObjectId(storeId);
  return StorePreference.findOne({ storeId: storeObjectId })
    .select('mobileFeatures shopShowcase storeId updatedAt')
    .lean();
}

async function resolveDefaultStorePreference() {
  await connectDB();
  const Store = (await import('@/models/Store')).default;
  const Product = (await import('@/models/Product')).default;
  const { resolvePublicFeaturedStore } = await import('@/lib/featuredProducts');
  const store = await resolvePublicFeaturedStore(Store, Product);
  if (store?._id) {
    const byStore = await StorePreference.findOne({ storeId: store._id })
      .select('mobileFeatures shopShowcase storeId updatedAt')
      .lean();
    if (byStore) return byStore;
  }
  return StorePreference.findOne()
    .sort({ updatedAt: -1 })
    .select('mobileFeatures shopShowcase storeId updatedAt')
    .lean();
}

/**
 * Factory for QuickFynd-compatible banner section routes:
 * GET public, POST/PUT seller auth.
 */
export function createMobileBannerSectionHandlers(sectionKey) {
  async function GET(request) {
    try {
      const { searchParams } = new URL(request.url);
      const storeIdParam = String(searchParams.get('storeId') || '').trim();
      const cacheKey = `${MOBILE_FEATURES_CACHE_KEY}:${sectionKey}:${storeIdParam || 'default'}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        return NextResponse.json(cached, {
          headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
        });
      }

      let pref = null;
      if (storeIdParam) {
        pref = await loadStorePreference(storeIdParam);
      } else {
        pref = await resolveDefaultStorePreference();
      }

      const payload = getSectionPublicPayload(
        sectionKey,
        pref?.mobileFeatures || {},
        pref?.shopShowcase || null,
      );
      setCachedData(cacheKey, payload, 60);
      return NextResponse.json(payload, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    } catch (error) {
      console.error(`[mobile-banner GET ${sectionKey}]`, error);
      return NextResponse.json(getSectionPublicPayload(sectionKey, {}), { status: 200 });
    }
  }

  async function save(request) {
    try {
      const auth = await requireSeller(request);
      if (auth.error) return auth.error;

      const body = await request.json();
      const sectionValue = normalizeBannerSection(sectionKey, body || {});

      await connectDB();
      const storeObjectId = resolveStoreObjectId(auth.storeId);
      const existing = await StorePreference.findOne({ storeId: storeObjectId })
        .select('mobileFeatures')
        .lean();

      const nextMobileFeatures = mergeSectionIntoMobileFeatures(
        existing?.mobileFeatures || {},
        sectionKey,
        sectionValue,
      );

      const updated = await StorePreference.findOneAndUpdate(
        { storeId: storeObjectId },
        { $set: { mobileFeatures: nextMobileFeatures } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
        .select('mobileFeatures')
        .lean();

      invalidateMobileFeaturesCache();

      const normalized = normalizeMobileFeatures(updated?.mobileFeatures || nextMobileFeatures);
      return NextResponse.json({
        success: true,
        ...normalized[sectionKey],
      });
    } catch (error) {
      console.error(`[mobile-banner SAVE ${sectionKey}]`, error);
      return NextResponse.json({ error: 'Failed to save banner settings' }, { status: 500 });
    }
  }

  return {
    GET,
    POST: save,
    PUT: save,
  };
}
