import { configureStore } from '@reduxjs/toolkit'
import cartReducer, { uploadCart } from './features/cart/cartSlice'
import productReducer from './features/product/productSlice'
import addressReducer from './features/address/addressSlice'
import ratingReducer from './features/rating/ratingSlice'
import { auth } from './firebase'
import { trackAddToCart } from './metaPixelTracking'
import { trackAddToCartFromPayload } from './trackingClient'
import { STORE_CURRENCY } from './storeCurrency'

let cartSyncDebounce = null

const CART_SYNC_ACTIONS = new Set([
    'cart/addToCart',
    'cart/removeFromCart',
    'cart/deleteItemFromCart',
    'cart/clearCart',
    'cart/setCartEntry',
    'cart/setCartItemQuantity',
])

// Persist cart to localStorage after cart actions (runs on client only)
const cartPersistenceMiddleware = store => next => action => {
    const result = next(action);
    if (typeof window !== 'undefined' && action.type.startsWith('cart/')) {
        if (action.type === 'cart/addToCart') {
            // Meta AddToCart (all add paths: product page, card, wishlist, bundles)
            const productId = String(action?.payload?.productId || '').trim();
            const price = Number(action?.payload?.price || 0);
            const quantity = Number(action?.payload?.quantity || 1);
            const unitPrice = Number.isFinite(price) ? price : 0;
            const qty = Number.isFinite(quantity) ? quantity : 1;
            trackAddToCart({
                productId,
                name: action?.payload?.productName || action?.payload?.name,
                price: unitPrice,
                quantity: qty,
                currency: STORE_CURRENCY,
                dedupeKey: `${productId}:${qty}:${unitPrice}`,
            });
            trackAddToCartFromPayload(action.payload || {});
        }

        try {
            const cartState = store.getState().cart;
            localStorage.setItem('cartState', JSON.stringify(cartState));
        } catch (e) {
            console.warn('[cartMiddleware] failed to persist cartState', e);
        }

        // Auto-sync cart mutations to DB for signed-in users
        if (CART_SYNC_ACTIONS.has(action.type) && auth?.currentUser) {
            if (cartSyncDebounce) {
                clearTimeout(cartSyncDebounce)
            }
            cartSyncDebounce = setTimeout(() => {
                store.dispatch(uploadCart())
            }, 300)
        }
    }
    return result;
};

export const makeStore = () => configureStore({
    reducer: {
        cart: cartReducer,
        product: productReducer,
        address: addressReducer,
        rating: ratingReducer,
    },
    middleware: (getDefault) => getDefault().concat(cartPersistenceMiddleware),
    // No need to add thunk manually; it's included by default
});