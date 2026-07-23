import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Store from '@/models/Store';
import Product from '@/models/Product';
import StorePreference from '@/models/StorePreference';
import { getCachedData, setCachedData } from '@/lib/cache';
import { resolvePublicFeaturedStore } from '@/lib/featuredProducts';
import {
  DEFAULT_MOBILE_FEATURES,
  MOBILE_FEATURES_CACHE_KEY,
  toPublicMobileFeatures,
} from '@/lib/mobileFeatures';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

async function resolvePreference(storeIdQuery) {
  const queried = String(storeIdQuery || '').trim();
  if (queried && mongoose.Types.ObjectId.isValid(queried)) {
    const byQuery = await StorePreference.findOne({ storeId: queried })
      .select('mobileFeatures shopShowcase storeId updatedAt')
      .lean();
    if (byQuery) return byQuery;
  }

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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const cacheKey = storeId
      ? `${MOBILE_FEATURES_CACHE_KEY}:${storeId}`
      : MOBILE_FEATURES_CACHE_KEY;

    const cached = getCachedData(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      });
    }

    await connectDB();
    const pref = await resolvePreference(storeId);
    const payload = {
      success: true,
      storeId: pref?.storeId ? String(pref.storeId) : null,
      mobileFeatures: toPublicMobileFeatures(
        pref?.mobileFeatures || DEFAULT_MOBILE_FEATURES,
        pref?.shopShowcase || null,
      ),
    };

    setCachedData(cacheKey, payload, 60);

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('[public/mobile-features GET]', error);
    return NextResponse.json(
      {
        success: true,
        storeId: null,
        mobileFeatures: toPublicMobileFeatures(DEFAULT_MOBILE_FEATURES),
      },
      { status: 200 },
    );
  }
}
