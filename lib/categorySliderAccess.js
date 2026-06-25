import { getAuth } from '@/lib/firebase-admin';
import authAdmin from '@/middlewares/authAdmin';
import authSeller from '@/middlewares/authSeller';

export async function resolveCategorySliderAccess(token) {
  if (!token) return null;

  const decoded = await getAuth().verifyIdToken(token);
  const userId = decoded.uid;
  const email = decoded.email || '';
  const isAdmin = await authAdmin(userId, email);
  const storeId = await authSeller(userId);

  if (!isAdmin && !storeId) return null;

  return {
    userId,
    email,
    isAdmin: Boolean(isAdmin),
    storeId: storeId ? String(storeId) : null,
    storeIds: storeId
      ? [...new Set([String(storeId), String(userId)])]
      : [],
  };
}

export function buildCategorySliderFilter(id, scope) {
  if (scope.isAdmin) {
    return { _id: id };
  }
  return { _id: id, storeId: { $in: scope.storeIds } };
}
