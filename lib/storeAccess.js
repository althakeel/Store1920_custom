import connectDB from '@/lib/mongodb';
import authSeller from '@/middlewares/authSeller';
import Store from '@/models/Store';

/**
 * Resolve dashboard store access for owners and invited team members.
 * Many legacy settings documents (StoreMenu, NavbarMenuSettings, etc.) are keyed
 * by the store owner's Firebase uid — use `ownerUserId` for those lookups.
 */
export async function resolveStoreAccess(userId) {
  if (!userId) return null;

  await connectDB();

  const storeId = await authSeller(userId);
  if (!storeId) return null;

  const store = await Store.findById(storeId).lean();
  if (!store || store.status === 'rejected') return null;

  return {
    storeId: String(storeId),
    ownerUserId: store.userId,
    store,
  };
}
