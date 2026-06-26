import mongoose from 'mongoose';
import StorePreference from '@/models/StorePreference';
import { resolvePublicFeaturedStore } from '@/lib/featuredProducts';

function toStoreObjectId(storeId) {
  const value = String(storeId || '').trim();
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

export async function resolvePublicStorePreference(Store, Product) {
  const store = await resolvePublicFeaturedStore(Store, Product);
  const storeObjectId = toStoreObjectId(store?._id);

  if (storeObjectId) {
    const byStore = await StorePreference.findOne({ storeId: storeObjectId })
      .select('shopShowcase updatedAt storeId')
      .lean();

    if (byStore) return byStore;
  }

  return StorePreference.findOne()
    .sort({ updatedAt: -1 })
    .select('shopShowcase updatedAt storeId')
    .lean();
}
