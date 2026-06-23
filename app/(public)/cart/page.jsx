
"use client";

import { useDispatch, useSelector, useStore } from "react-redux";
import { useEffect, useLayoutEffect, useState } from "react";
import axios from "axios";
import Counter from "@/components/Counter";
import CartSummaryBox from "@/components/CartSummaryBox";
import ProductCard from "@/components/ProductCard";
import { deleteItemFromCart, fetchCart, uploadCart } from "@/lib/features/cart/cartSlice";
import { PackageIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/lib/useAuth";
import { trackViewCart } from "@/lib/metaPixelTracking";
import { pushGtmEcommerceEvent, toGtmItem } from "@/lib/pushGtmEcommerceEvent";
import { runTrackedOnce } from "@/lib/trackingDedupe";
import { GTM_EVENTS, gtmDedupeKey } from "@/lib/gtmEvents";
import { STORE_CURRENCY } from "@/lib/storeCurrency";
import { getCartEntryProductId, getCartEntryQuantity, isFreeGiftEntry } from "@/lib/freeGiftUtils";

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
                const unitPrice = isFreeGift
                    ? 0
                    : ((typeof value === 'object' ? value?.price : undefined) ?? product.price ?? 0);
                arr.push({
                    ...product,
                    quantity: qty,
                    _cartPrice: unitPrice,
                    _cartKey: key,
                    _productId: actualProductId,
                    _isFreeGift: isFreeGift,
                    _freeGiftTitle: typeof value === 'object' ? value?.freeGift?.title || '' : '',
                });
                const isOutOfStock = product.inStock === false || (typeof product.stockQuantity === 'number' && product.stockQuantity <= 0);
                if (!isOutOfStock && !isFreeGift) {
                    total += unitPrice * qty;
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
        if (products.length > 0) {
            createCartArray();
        }
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

    const handleDeleteItemFromCart = async (cartKey) => {
        const key = String(cartKey || '');
        if (!key) return;

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

                    // Force DB cart to exactly match current Redux cart (extra safety)
                    const latestCart = store.getState()?.cart?.cartItems || {};
                    await axios.post('/api/cart', { cart: latestCart }, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                } else {
                    await dispatch(uploadCart({ getToken }));
                }
                await dispatch(fetchCart({ getToken }));
            } finally {
                setDeletingKeys((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            }
            return;
        }

        setDeletingKeys((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const getMaxQty = (item) => {
        if (item?.inStock === false) return 0;
        if (typeof item?.stockQuantity === 'number') return Math.max(0, item.stockQuantity);
        return null;
    };

    const inStockCartArray = cartArray.filter((item) => getMaxQty(item) !== 0);
    const outOfStockCartArray = cartArray.filter((item) => getMaxQty(item) === 0);
    const checkoutDisabled = inStockCartArray.length === 0;

    useLayoutEffect(() => {
        if (typeof window === 'undefined') return;
        if (!inStockCartArray.length) return;

        const contentIds = inStockCartArray
            .map((item) => String(item?._id || item?._cartKey || ''))
            .filter(Boolean);

        const cartSignature = `${contentIds.join(',')}_${Number(totalPrice || 0)}`;

        runTrackedOnce(gtmDedupeKey(GTM_EVENTS.VIEW_CART, cartSignature), () => {
            trackViewCart({
                value: Number(totalPrice || 0),
                currency: STORE_CURRENCY,
                items: inStockCartArray.map((item) => ({
                    productId: String(item?._id || item?._cartKey || ''),
                    quantity: Number(item?.quantity || 0),
                })),
                numItems: inStockCartArray.reduce((sum, item) => sum + Number(item?.quantity || 0), 0),
            });

            pushGtmEcommerceEvent(GTM_EVENTS.VIEW_CART, {
                currency: STORE_CURRENCY,
                value: Number(totalPrice || 0),
                items: inStockCartArray.map((item) => toGtmItem(item)),
            });
        });
    }, [inStockCartArray, totalPrice]);

    return (
        <div className="min-h-[40dvh]">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
                {!productsLoaded ? (
                    <div className="text-center py-16 text-gray-400">Loading cart…</div>
                ) : cartArray.length > 0 ? (
                    <>
                        <div className="mb-6">
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Cart ({cartArray.length})</h1>
                        </div>

                        <div className="flex gap-6 max-lg:flex-col" dir="ltr">
                            <div className="flex-1 space-y-4">
                                {inStockCartArray.map((item, index) => (
                                    <div key={item._cartKey || index} className="rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow" style={{ background: "inherit" }}>
                                        {(() => {
                                            const maxQty = getMaxQty(item);
                                            return (
                                        <div className="flex gap-4">
                                            <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                                                <Image
                                                    src={item.images[0]}
                                                    alt={item.name}
                                                    width={96}
                                                    height={96}
                                                    className="w-full h-full object-contain p-2"
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-gray-900 text-sm md:text-base line-clamp-2 mb-1">{item.name}</h3>
                                                <p className="text-xs text-gray-500 mb-1">{item.category}</p>
                                                {item._isFreeGift ? (
                                                    <p className="text-xs font-semibold text-green-600 mb-2">Free gift{item._freeGiftTitle ? ` • ${item._freeGiftTitle}` : ''}</p>
                                                ) : null}
                                                <div className="flex items-center justify-between mt-3">
                                                    <div>
                                                        <p className="text-lg font-bold text-orange-600">{item._isFreeGift ? 'FREE' : `${currency} ${(item._cartPrice ?? item.price ?? 0).toLocaleString()}`}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {item._isFreeGift ? (
                                                            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Qty 1 gift</span>
                                                        ) : (
                                                            <Counter productId={item._cartKey || item._id} maxQty={maxQty} />
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between mt-3 md:hidden">
                                                    <p className="text-sm font-semibold text-gray-900">Total: {item._isFreeGift ? 'FREE' : `${currency}${((item._cartPrice ?? item.price ?? 0) * item.quantity).toLocaleString()}`}</p>
                                                    {!item._isFreeGift ? (
                                                        <button
                                                            onClick={() => handleDeleteItemFromCart(item._cartKey || item._id)}
                                                            disabled={!!deletingKeys[item._cartKey]}
                                                            type="button"
                                                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                                                        >
                                                            {deletingKeys[item._cartKey] ? 'REMOVING...' : 'REMOVE'}
                                                        </button>
                                                    ) : <span className="text-xs font-medium text-green-700">AUTO-ADDED</span>}
                                                </div>
                                            </div>

                                            <div className="hidden md:flex flex-col items-end justify-between">
                                                {!item._isFreeGift ? (
                                                    <button
                                                        onClick={() => handleDeleteItemFromCart(item._cartKey || item._id)}
                                                        disabled={!!deletingKeys[item._cartKey]}
                                                        type="button"
                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2Icon size={20} />
                                                    </button>
                                                ) : <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">AUTO-ADDED</span>}
                                                <p className="text-lg font-bold text-gray-900">{item._isFreeGift ? 'FREE' : `${currency}${((item._cartPrice ?? item.price ?? 0) * item.quantity).toLocaleString()}`}</p>
                                            </div>
                                        </div>
                                            );
                                        })()}
                                    </div>
                                ))}

                                {outOfStockCartArray.length > 0 && (
                                    <>
                                        <div className="pt-2 mt-2 border-t border-gray-200">
                                            <h2 className="text-lg md:text-xl font-bold text-red-600">Out of Stock Products</h2>
                                            <p className="text-xs text-gray-500 mt-1">These items are kept in cart but excluded from checkout.</p>
                                        </div>
                                        {outOfStockCartArray.map((item, index) => (
                                            <div key={`oos-${item._cartKey || index}`} className="rounded-lg p-4 shadow-sm border border-red-100 bg-red-50/40">
                                                <div className="flex gap-4">
                                                    <div className="w-24 h-24 flex-shrink-0 bg-white rounded-lg overflow-hidden">
                                                        <Image
                                                            src={item.images[0]}
                                                            alt={item.name}
                                                            width={96}
                                                            height={96}
                                                            className="w-full h-full object-contain p-2"
                                                        />
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-semibold text-gray-900 text-sm md:text-base line-clamp-2 mb-1">{item.name}</h3>
                                                        <p className="text-xs text-gray-500 mb-1">{item.category}</p>
                                                        <p className="text-xs font-semibold text-red-600 mb-2">Out of Stock</p>

                                                        <div className="flex items-center justify-between mt-3">
                                                            <div>
                                                                <p className="text-lg font-bold text-orange-600">{currency} {(item._cartPrice ?? item.price ?? 0).toLocaleString()}</p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Counter productId={item._cartKey || item._id} maxQty={0} />
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between mt-3 md:hidden">
                                                            <p className="text-sm font-semibold text-gray-900">Total: {currency}{((item._cartPrice ?? item.price ?? 0) * item.quantity).toLocaleString()}</p>
                                                            <button
                                                                onClick={() => handleDeleteItemFromCart(item._cartKey || item._id)}
                                                                disabled={!!deletingKeys[item._cartKey]}
                                                                type="button"
                                                                className="text-red-500 hover:text-red-700 text-sm font-medium"
                                                            >
                                                                {deletingKeys[item._cartKey] ? 'REMOVING...' : 'REMOVE'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="hidden md:flex flex-col items-end justify-between">
                                                        <button
                                                            onClick={() => handleDeleteItemFromCart(item._cartKey || item._id)}
                                                            disabled={!!deletingKeys[item._cartKey]}
                                                            type="button"
                                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2Icon size={20} />
                                                        </button>
                                                        <p className="text-lg font-bold text-gray-900">{currency}{((item._cartPrice ?? item.price ?? 0) * item.quantity).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>
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
                                    />
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col justify-center items-center py-20">
                        <div className="bg-white shadow-lg rounded-lg p-8 text-center max-w-md">
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
