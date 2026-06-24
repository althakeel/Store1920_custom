'use client'
import { useDispatch, useSelector } from "react-redux";
import {
  adjustBundleCartTier,
  getBundleTierFromEntry,
  isBulkBundleProduct,
  resolveCartLinePricing,
} from '@/lib/bulkBundleCart';
import { decrementCartItem, incrementCartItem } from '@/lib/bundleCartActions';

const Counter = ({ productId, maxQty, product }) => {

    const { cartItems } = useSelector(state => state.cart);

    const dispatch = useDispatch();

    const entry = cartItems[productId];
    const quantity = typeof entry === 'number' ? entry : entry?.quantity || 0;
    const pricing = product ? resolveCartLinePricing(product, entry, quantity) : null;
    const isBundle = Boolean(product && isBulkBundleProduct(product));
    const displayQuantity = isBundle
      ? (getBundleTierFromEntry(entry, product) || pricing?.displayQuantity || quantity)
      : quantity;
    const normalizedMaxQty = typeof maxQty === 'number' ? Math.max(0, maxQty) : null;
    const canIncrement = isBundle
      ? Boolean(adjustBundleCartTier(entry, product, 'up'))
      : (normalizedMaxQty === null ? true : quantity < normalizedMaxQty);

    const addToCartHandler = () => {
        incrementCartItem(dispatch, {
          productId,
          entry,
          product,
          price: typeof entry === 'object' ? entry?.price : undefined,
          maxQty: normalizedMaxQty,
        });
    }

    const removeFromCartHandler = () => {
        decrementCartItem(dispatch, { productId, entry, product });
    }

    return (
        <div className="inline-flex items-center gap-1 sm:gap-3 px-3 py-1 rounded border border-slate-200 max-sm:text-sm text-slate-600">
            <button onClick={removeFromCartHandler} className="p-1 select-none">-</button>
            <p className="p-1">{displayQuantity}</p>
            <button
                onClick={addToCartHandler}
                disabled={!canIncrement}
                className={`p-1 select-none ${!canIncrement ? 'opacity-40 cursor-not-allowed' : ''}`}
            >+
            </button>
        </div>
    )
}

export default Counter
