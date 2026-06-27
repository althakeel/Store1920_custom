
"use client";

import { useDispatch, useSelector, useStore } from "react-redux";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import CartLineItem from "@/components/CartLineItem";
import CartSummaryBox, { CartSummaryActions } from "@/components/CartSummaryBox";
import CartRemoveConfirm from "@/components/CartRemoveConfirm";
import ProductCard from "@/components/ProductCard";
import { deleteItemFromCart, fetchCart, uploadCart } from "@/lib/features/cart/cartSlice";
import { decrementCartItem } from "@/lib/bundleCartActions";
import { PackageIcon } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { trackViewCartDual } from "@/lib/ecommerceTracking";
import { pushGtmEcommerceEvent, toGtmItem } from "@/lib/pushGtmEcommerceEvent";
import { runTrackedOnce } from "@/lib/trackingDedupe";
import { GTM_EVENTS, gtmDedupeKey } from "@/lib/gtmEvents";
import { STORE_CURRENCY } from "@/lib/storeCurrency";
import { getCartEntryProductId, getCartEntryQuantity, isFreeGiftEntry } from "@/lib/freeGiftUtils";
import { adjustBundleCartTier, isBulkBundleProduct, resolveCartLinePricing } from "@/lib/bulkBundleCart";
import { getOrCreateAnonymousId, getOrCreateSessionId } from '@/lib/trackingClient';

export const dynamic = "force-dynamic";

export default function Cart() {
    const dispatch = useDispatch();
    const store = useStore();
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || "AED";
    const { user, getToken } = useAuth();
    const isSignedIn = !!user;

    const { cartItems } = useSelector((state) => state.cart);
    const products = useSelector((state) => state.product.list);

    const [productsLoaded, setProductsLoaded] = useState(false);
    const [cartArray, setCartArray] = useState([]);
    const [totalPrice, setTotalPrice] = useState(0);
    const [recentOrders, setRecentOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const shippingFee = 0;
    const [deletingKeys, setDeletingKeys] = useState({});
    const [pendingRemove, setPendingRemove] = useState(null);
    const [cartHeartbeat, setCartHeartbeat] = useState(0);
    const viewCartTrackedRef = useRef(false);


    // Load only cart product IDs via batch API (never download full catalog)
    useEffect(() => {
        const normalizedIds = [...new Set(
            Object.entries(cartItems || {})
                .map(([cartKey, entry]) => getCartEntryProductId(cartKey, entry))
                .filter((id) => {
                    const trimmed = String(id || '').trim();
                    return trimmed.length > 0 && trimmed !== 'undefined' && trimmed !== 'null';
                })
        )];

        if (normalizedIds.length === 0) {
            setProductsLoaded(true);
            return undefined;
        }

        const missingIds = normalizedIds.filter(
            (id) => !products?.some((p) => String(p._id) === String(id))
        );

        if (missingIds.length === 0) {
            setProductsLoaded(true);
            return undefined;
        }

        let ignore = false;
        const loadMissingProducts = async () => {
            try {
                const { data } = await axios.post('/api/products/batch', {
                    productIds: missingIds,
                });
                if (ignore || !data?.products?.length) return;

                const existing = new Set((products || []).map((p) => String(p._id)));
                const merged = [...(products || [])];
                data.products.forEach((p) => {
                    if (!existing.has(String(p._id))) {
                        merged.push(p);
                    }
                });
                dispatch({ type: "product/setProduct", payload: merged });
            } catch (error) {
                const details = error?.response?.data;
                if (details || error?.message) {
                    console.warn('[Cart] Missing products fetch skipped:', details || error.message);
                }
            } finally {
                if (!ignore) setProductsLoaded(true);
            }
        };

        loadMissingProducts();
        return () => {
            ignore = true;
        };
    }, [cartItems, products, dispatch]);

    const createCartArray = () => {
        let total = 0;
        const arr = [];
        const invalidKeys = [];

        for (const [key, value] of Object.entries(cartItems || {})) {
            const actualProductId = getCartEntryProductId(key, value);
            const product = products.find((p) => String(p._id) === String(actualProductId));
            const qty = getCartEntryQuantity(value);
            const isFreeGift = isFreeGiftEntry(value);

            if (product && qty > 0) {
                const pricing = resolveCartLinePricing(product, value, qty);
                arr.push({
                    ...product,
                    quantity: qty,
                    _cartPrice: pricing.unitPrice,
                    _lineTotal: pricing.lineTotal,
                    _displayQuantity: pricing.displayQuantity,
                    _isBulkBundle: pricing.isBulkBundle,
                    _bundleTier: pricing.bundleTier,
                    _cartKey: key,
                    _productId: actualProductId,
                    _isFreeGift: isFreeGift,
                    _freeGiftTitle: typeof value === 'object' ? value?.freeGift?.title || '' : '',
                });
                const isOutOfStock = product.inStock === false || (typeof product.stockQuantity === 'number' && product.stockQuantity <= 0);
                if (!isOutOfStock && !isFreeGift) {
                    total += pricing.lineTotal;
                }
            } else if (!product && qty > 0) {
                console.warn('[Cart Page] Product not found in list:', key, 'qty:', qty);
                invalidKeys.push(key);
            }
        }

        // Only delete after products are confirmed loaded
        // (to avoid deleting valid items during initial load)
        if (productsLoaded && invalidKeys.length > 0) {
            invalidKeys.forEach((key) => dispatch(deleteItemFromCart({ productId: key })));
            dispatch(uploadCart({ getToken }));
        }

        setCartArray(arr);
        setTotalPrice(total);
    };

    useEffect(() => {
        if (!productsLoaded) return;
        createCartArray();
    }, [cartItems, products, productsLoaded]);

    const fetchRecentOrders = async () => {
        if (!isSignedIn) {
            setLoadingOrders(false);
            return;
        }
        try {
            const token = await getToken();
            const { data } = await axios.get("/api/orders", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const recentProducts = [];
            const seen = new Set();
            if (data.orders && data.orders.length > 0) {
                for (const order of data.orders) {
                    for (const item of order.orderItems) {
                        const product = item?.product;
                        const productId = product?._id || item?.productId;
                        if (!product || !productId) continue;
                        if (!seen.has(productId) && recentProducts.length < 8) {
                            seen.add(productId);
                            recentProducts.push(product);
                        }
                    }
                    if (recentProducts.length >= 8) break;
                }
            }
            setRecentOrders(recentProducts);
        } catch (e) {
            console.error("Failed to fetch recent orders", e);
        } finally {
            setLoadingOrders(false);
        }
    };

    useEffect(() => {
        fetchRecentOrders();
    }, [isSignedIn]);

    // Keep cart in sync with DB for signed-in users (initial + on focus)
    useEffect(() => {
        if (!user) return;

        const syncFromServer = () => {
            dispatch(fetchCart({ getToken: async () => user.getIdToken() }));
        };

        syncFromServer();
        window.addEventListener('focus', syncFromServer);

        return () => {
            window.removeEventListener('focus', syncFromServer);
        };
    }, [user, dispatch]);

    // Keep abandoned-cart timer alive while customer is still on the cart page
    useEffect(() => {
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            setCartHeartbeat((count) => count + 1);
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Refresh signed-in abandoned cart activity while the page stays open
    useEffect(() => {
        if (!user) return;
        if (!Object.keys(cartItems || {}).length) return;
        dispatch(uploadCart({ getToken }));
    }, [user, cartItems, cartHeartbeat, dispatch, getToken]);

    // Track guest abandoned carts (debounced)
    useEffect(() => {
        if (user) return;
        const cartEntries = Object.entries(cartItems || {});
        if (!cartEntries.length || !productsLoaded) return;

        const timer = setTimeout(async () => {
            let guestContact = null;
            try {
                guestContact = JSON.parse(localStorage.getItem('store1920_guest_contact') || 'null');
            } catch (_) {}

            const guestEmail = guestContact?.email?.trim() || null;
            const guestPhone = guestContact?.phone?.trim() || null;
            const anonymousId = getOrCreateAnonymousId();
            const sessionId = getOrCreateSessionId();
            if (!guestEmail && !guestPhone && !anonymousId) return;

            const items = cartEntries.map(([key, value]) => {
                const productId = getCartEntryProductId(key, value);
                const quantity = getCartEntryQuantity(value);
                const product = products.find((p) => String(p._id) === String(productId));
                if (!productId || quantity <= 0 || isFreeGiftEntry(value)) return null;
                const pricing = resolveCartLinePricing(product, value, quantity);
                return {
                    productId,
                    quantity,
                    price: pricing.unitPrice,
                    name: product?.name || 'Product',
                    variantOptions: typeof value === 'object' ? value?.variantOptions || null : null,
                };
            }).filter(Boolean);

            if (!items.length) return;

            try {
                await fetch('/api/guest/abandoned-cart', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items,
                        guestEmail,
                        guestPhone,
                        guestName: guestContact?.name || null,
                        guestPhoneCode: guestContact?.phoneCode || '+971',
                        anonymousId,
                        sessionId,
                    }),
                    keepalive: true,
                });
            } catch (_) {}
        }, 1500);

        return () => clearTimeout(timer);
    }, [user, cartItems, products, productsLoaded, cartHeartbeat]);

    const handleDeleteItemFromCart = async (cartKey) => {
        const key = String(cartKey || '');
        if (!key) return false;

        const removedItem = cartArray.find((item) => String(item._cartKey || item._id) === key);
        if (removedItem) {
            pushGtmEcommerceEvent(GTM_EVENTS.REMOVE_FROM_CART, {
                currency: STORE_CURRENCY,
                value: Number(removedItem.price || 0) * Number(removedItem.quantity || 1),
                items: [toGtmItem(removedItem)],
            });
        }

        setDeletingKeys((prev) => ({ ...prev, [key]: true }));
        dispatch(deleteItemFromCart({ productId: key }));

        if (isSignedIn) {
            try {
                const token = await getToken();
                if (token) {
                    await axios.delete(`/api/cart?productId=${encodeURIComponent(key)}`, {
                        headers: { Authorization: `Bearer ${token}` },
                        data: { productId: key },
                    });

                    const latestCart = store.getState()?.cart?.cartItems || {};
                    await axios.post('/api/cart', { cart: latestCart }, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                } else {
                    await dispatch(uploadCart({ getToken }));
                }
            } catch (error) {
                console.warn('[Cart] Failed to sync removed item:', error?.response?.data || error?.message);
            } finally {
                setDeletingKeys((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            }
            return true;
        }

        setDeletingKeys((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        return true;
    };

    const getMaxQty = (item) => {
        if (item?.inStock === false) return 0;
        if (typeof item?.stockQuantity === 'number') return Math.max(0, item.stockQuantity);
        return null;
    };

    const inStockCartArray = cartArray.filter((item) => getMaxQty(item) !== 0);
    const outOfStockCartArray = cartArray.filter((item) => getMaxQty(item) === 0);
    const checkoutDisabled = inStockCartArray.length === 0;

    const getRemovableInStockItems = () => inStockCartArray.filter((item) => !item._isFreeGift);

    const isLastRemovableItem = (cartKey) => {
        const removableItems = getRemovableInStockItems();
        if (removableItems.length !== 1) return false;
        const onlyItem = removableItems[0];
        return String(onlyItem?._cartKey || onlyItem?._id || '') === String(cartKey || '');
    };

    const wouldDecrementRemoveItem = (item) => {
        const cartKey = item._cartKey || item._id;
        const entry = cartItems?.[cartKey];
        if (item?._isBulkBundle || isBulkBundleProduct(item)) {
            return adjustBundleCartTier(entry, item, 'down') === 'remove';
        }
        return getCartEntryQuantity(entry) <= 1;
    };

    const needsLastItemRemoveConfirm = (cartKey) => isLastRemovableItem(cartKey);

    const handleRequestRemove = (cartKey) => {
        if (needsLastItemRemoveConfirm(cartKey)) {
            const item = inStockCartArray.find((entry) => String(entry._cartKey || entry._id) === String(cartKey));
            setPendingRemove({
                cartKey: String(cartKey),
                productName: item?.name || 'this item',
            });
            return;
        }
        handleDeleteItemFromCart(cartKey);
    };

    const handleRequestDecrease = (cartKey, item) => {
        if (isLastRemovableItem(cartKey) && wouldDecrementRemoveItem(item)) {
            setPendingRemove({
                cartKey: String(cartKey),
                productName: item?.name || 'this item',
            });
            return;
        }
        const entry = cartItems?.[cartKey];
        decrementCartItem(dispatch, { productId: cartKey, entry, product: item });
    };

    const handleConfirmRemove = async () => {
        if (!pendingRemove?.cartKey) return;
        const cartKey = pendingRemove.cartKey;
        const removed = await handleDeleteItemFromCart(cartKey);
        if (removed) {
            setPendingRemove(null);
        }
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!productsLoaded) return;
        if (!inStockCartArray.length) return;
        if (viewCartTrackedRef.current) return;

        viewCartTrackedRef.current = true;

        const cartValue = Number(totalPrice || 0);
        const gtmItems = inStockCartArray.map((item) => toGtmItem(item));

        trackViewCartDual({
            value: cartValue,
            currency: STORE_CURRENCY,
            gtmItems,
            metaItems: inStockCartArray.map((item) => ({
                productId: String(item?._id || item?._cartKey || ''),
                quantity: Number(item?.quantity || 0),
            })),
            numItems: inStockCartArray.reduce((sum, item) => sum + Number(item?.quantity || 0), 0),
            pageKey: '/cart',
        });
    }, [productsLoaded, inStockCartArray, totalPrice]);

    return (
        <div className="min-h-[40dvh] bg-slate-50/60 pb-28 lg:pb-0">
            <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
                {!productsLoaded ? (
                    <div className="py-16 text-center text-slate-400">Loading cart…</div>
                ) : cartArray.length > 0 ? (
                    <>
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Your cart</h1>
                            <p className="mt-1 text-sm text-slate-500">
                                {inStockCartArray.length} item{inStockCartArray.length === 1 ? '' : 's'} ready for checkout
                                {outOfStockCartArray.length > 0
                                    ? ` · ${outOfStockCartArray.length} out of stock`
                                    : ''}
                            </p>
                        </div>

                        <div className="flex gap-6 max-lg:flex-col" dir="ltr">
                            <div className="flex-1 space-y-4">
                                {inStockCartArray.map((item, index) => (
                                    <CartLineItem
                                        key={item._cartKey || index}
                                        item={item}
                                        maxQty={getMaxQty(item)}
                                        currency={currency}
                                        onRemove={handleRequestRemove}
                                        onDecrease={handleRequestDecrease}
                                        isRemoving={!!deletingKeys[item._cartKey]}
                                    />
                                ))}

                                {outOfStockCartArray.length > 0 && (
                                    <>
                                        <div className="border-t border-slate-200 pt-6 mt-2">
                                            <h2 className="text-lg font-bold text-red-600 md:text-xl">Unavailable items</h2>
                                            <p className="mt-1 text-xs text-slate-500">
                                                Kept in your cart but excluded from checkout until back in stock.
                                            </p>
                                        </div>
                                        {outOfStockCartArray.map((item, index) => (
                                            <CartLineItem
                                                key={`oos-${item._cartKey || index}`}
                                                item={item}
                                                maxQty={0}
                                                currency={currency}
                                                onRemove={handleRequestRemove}
                                                onDecrease={handleRequestDecrease}
                                                isRemoving={!!deletingKeys[item._cartKey]}
                                                isOutOfStock
                                            />
                                        ))}
                                    </>
                                )}
                            </div>

                            <div className="lg:w-[380px]">
                                <div className="lg:sticky lg:top-6 space-y-6">
                                    <CartSummaryBox
                                        subtotal={totalPrice}
                                        shipping={0}
                                        total={totalPrice}
                                        showShipping={false}
                                        checkoutDisabled={checkoutDisabled}
                                        checkoutNote={outOfStockCartArray.length > 0 ? `${outOfStockCartArray.length} out-of-stock item(s) are excluded from checkout.` : ''}
                                        hideMobileActions
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/90 lg:hidden">
                            <CartSummaryActions
                                checkoutDisabled={checkoutDisabled}
                                layout="row"
                            />
                        </div>

                        <CartRemoveConfirm
                            open={Boolean(pendingRemove)}
                            productName={pendingRemove?.productName}
                            isRemoving={pendingRemove ? !!deletingKeys[pendingRemove.cartKey] : false}
                            onCancel={() => setPendingRemove(null)}
                            onConfirm={handleConfirmRemove}
                        />
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                            <div className="w-14 h-14 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-4">
                                <PackageIcon className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
                            <p className="text-gray-500 mb-6">Add some products to get started</p>
                            <a href="/" className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
                                Continue Shopping
                            </a>
                        </div>
                    </div>
                )}

                {isSignedIn && !loadingOrders && recentOrders.length > 0 && (
                    <div className="mt-16 mb-12">
                        <div className="flex items-center gap-3 mb-6">
                            <PackageIcon className="text-slate-700" size={28} />
                            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Recently Ordered</h2>
                        </div>
                        <p className="text-slate-500 mb-6">Products from your recent orders</p>
                        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                            {recentOrders.map((product) => (
                                <ProductCard key={product._id} product={product} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
