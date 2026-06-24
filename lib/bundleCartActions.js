import { addToCart, deleteItemFromCart, removeFromCart, setCartEntry } from '@/lib/features/cart/cartSlice';
import {
  adjustBundleCartTier,
  isBulkBundleProduct,
} from '@/lib/bulkBundleCart';

export function incrementCartItem(dispatch, { productId, entry, product, price, maxQty }) {
  if (product && isBulkBundleProduct(product)) {
    const nextEntry = adjustBundleCartTier(entry, product, 'up');
    if (!nextEntry) return false;
    dispatch(setCartEntry({ productId, entry: nextEntry }));
    return true;
  }

  const quantity = typeof entry === 'number' ? entry : entry?.quantity || 0;
  const normalizedMaxQty = typeof maxQty === 'number' ? Math.max(0, maxQty) : null;
  if (normalizedMaxQty !== null && quantity >= normalizedMaxQty) return false;

  dispatch(addToCart({
    productId,
    price: typeof entry === 'object' ? entry?.price : price,
    maxQty: normalizedMaxQty,
    variantOptions: typeof entry === 'object' ? entry?.variantOptions : undefined,
    offerToken: typeof entry === 'object' ? entry?.offerToken : undefined,
    discountPercent: typeof entry === 'object' ? entry?.discountPercent : undefined,
  }));
  return true;
}

export function decrementCartItem(dispatch, { productId, entry, product }) {
  if (product && isBulkBundleProduct(product)) {
    const nextEntry = adjustBundleCartTier(entry, product, 'down');
    if (nextEntry === 'remove') {
      dispatch(deleteItemFromCart({ productId }));
      return true;
    }
    if (!nextEntry) return false;
    dispatch(setCartEntry({ productId, entry: nextEntry }));
    return true;
  }

  const quantity = typeof entry === 'number' ? entry : entry?.quantity || 0;
  if (quantity <= 1) {
    dispatch(deleteItemFromCart({ productId }));
    return true;
  }

  dispatch(removeFromCart({ productId }));
  return true;
}
