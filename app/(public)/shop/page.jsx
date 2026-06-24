"use client";
import { Suspense, useMemo, useState, useCallback, useEffect, useRef } from "react";
import ProductCard from "@/components/ProductCard"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from '@/lib/useAuth'
import axios from 'axios'
import { SlidersHorizontal, X } from 'lucide-react'
import ShopPagination from '@/components/ShopPagination'
import { getProductPath } from '@/lib/productUrl'

const PRODUCTS_PER_PAGE = 100;
const SHOP_CATALOG_URL = '/api/products?all=true&slim=true&includeOutOfStock=true';

function ShopContent() {
    const searchParams = useSearchParams();
    const search = searchParams.get('search');
    const categoryParam = searchParams.get('category');
    const currentPage = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [shopProducts, setShopProducts] = useState([]);
    const [shopLoading, setShopLoading] = useState(true);
    const [searchProducts, setSearchProducts] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [categoryProducts, setCategoryProducts] = useState([]);
    const [categoryLoading, setCategoryLoading] = useState(false);
    const [sortBy, setSortBy] = useState('newest');
    const [priceFilter, setPriceFilter] = useState('all');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [stockFilter, setStockFilter] = useState('all');
    const [ratingFilter, setRatingFilter] = useState('all');
    const [reviewFilter, setReviewFilter] = useState('all');
    const [bestSellerOnly, setBestSellerOnly] = useState(false);
    const [fastDeliveryOnly, setFastDeliveryOnly] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [fastSellingIndex, setFastSellingIndex] = useState(0);
    const { user, getToken } = useAuth();

    useEffect(() => {
        setMounted(true);
    }, []);

    // Save search to history (DB for logged in users, localStorage for guests)
    useEffect(() => {
        if (!search || !search.trim()) return;

        const saveSearch = async () => {
            const trimmedSearch = search.trim();
            
            if (user) {
                // Save to database for logged-in users
                try {
                    const token = await getToken();
                    await axios.post('/api/customer/recent-searches', 
                        { searchTerm: trimmedSearch },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } catch (error) {
                    console.error('Error saving search to database:', error);
                }
            } else {
                // Save to localStorage for guests
                try {
                    const existing = JSON.parse(localStorage.getItem('recentSearches') || '[]');
                    // Remove if already exists
                    const filtered = existing.filter(s => s !== trimmedSearch);
                    // Add to front
                    filtered.unshift(trimmedSearch);
                    // Keep only 20 most recent
                    const updated = filtered.slice(0, 20);
                    localStorage.setItem('recentSearches', JSON.stringify(updated));
                } catch (error) {
                    console.error('Error saving search to localStorage:', error);
                }
            }
        };

        saveSearch();
    }, [search, user, getToken]);

    useEffect(() => {
        let isActive = true;

        if (categoryParam) {
            setCategoryLoading(true);
            fetch(`/api/products?category=${encodeURIComponent(categoryParam)}&all=true&slim=true&includeOutOfStock=true`)
                .then((res) => res.json())
                .then((data) => {
                    if (!isActive) return;
                    setCategoryProducts(Array.isArray(data.products) ? data.products : []);
                })
                .catch(() => {
                    if (!isActive) return;
                    setCategoryProducts([]);
                })
                .finally(() => {
                    if (!isActive) return;
                    setCategoryLoading(false);
                });
            return () => {
                isActive = false;
            };
        }

        setShopLoading(true);
        fetch(SHOP_CATALOG_URL)
            .then((res) => res.json())
            .then((data) => {
                if (!isActive) return;
                setShopProducts(Array.isArray(data.products) ? data.products : []);
            })
            .catch(() => {
                if (!isActive) return;
                setShopProducts([]);
            })
            .finally(() => {
                if (!isActive) return;
                setShopLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, [categoryParam]);

    useEffect(() => {
        const term = search?.trim();
        if (!term) {
            setSearchProducts([]);
            setSearchLoading(false);
            return undefined;
        }

        let isActive = true;
        setSearchLoading(true);

        fetch(`/api/search-products?keyword=${encodeURIComponent(term)}&limit=100&includeOutOfStock=true`)
            .then((res) => res.json())
            .then((data) => {
                if (!isActive) return;
                setSearchProducts(Array.isArray(data.products) ? data.products : []);
            })
            .catch(() => {
                if (!isActive) return;
                setSearchProducts([]);
            })
            .finally(() => {
                if (!isActive) return;
                setSearchLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, [search]);

    const getProductPrice = useCallback((product) => {
        if (!product) return 0;
        const basePrice = Number(product.price || 0);

        if (Array.isArray(product.variants) && product.variants.length > 0) {
            const variantPrices = product.variants
                .map((variant) => Number(variant?.price || variant?.salePrice || 0))
                .filter((value) => Number.isFinite(value) && value > 0);

            if (variantPrices.length > 0) {
                return Math.min(...variantPrices);
            }
        }

        return Number.isFinite(basePrice) ? basePrice : 0;
    }, []);

    const isProductInStock = useCallback((product) => {
        if (!product) return false;
        if (product.inStock === false) return false;

        if (typeof product.stockQuantity === 'number') {
            return product.stockQuantity > 0;
        }

        if (Array.isArray(product.variants) && product.variants.length > 0) {
            return product.variants.some((variant) => Number(variant?.stock || 0) > 0);
        }

        return true;
    }, []);

    const getAverageRating = useCallback((product) => {
        const value = Number(product?.averageRating || 0);
        return Number.isFinite(value) ? value : 0;
    }, []);

    const getReviewCount = useCallback((product) => {
        const value = Number(product?.ratingCount || 0);
        return Number.isFinite(value) ? value : 0;
    }, []);

    const isBestSeller = useCallback((product) => {
        const badges = Array.isArray(product?.badges) ? product.badges : [];
        const tags = Array.isArray(product?.tags) ? product.tags : [];
        const hasBadge = badges.some((badge) => String(badge).toLowerCase() === 'best seller');
        const hasTag = tags.some((tag) => ['bestseller', 'best seller', 'top seller'].includes(String(tag).toLowerCase()));
        return hasBadge || hasTag;
    }, []);

    const sourceProducts = search?.trim()
        ? searchProducts
        : (categoryParam ? categoryProducts : shopProducts);

    const filteredProducts = useMemo(() => {
        return sourceProducts;
    }, [sourceProducts]);

    const visibleProducts = useMemo(() => {
        let list = [...filteredProducts];

        if (priceFilter !== 'all') {
            list = list.filter((product) => {
                const price = getProductPrice(product);
                if (priceFilter === 'under499') return price < 499;
                if (priceFilter === '500to999') return price >= 500 && price <= 999;
                if (priceFilter === '1000to1999') return price >= 1000 && price <= 1999;
                if (priceFilter === '2000plus') return price >= 2000;
                return true;
            });
        }

        const minPriceValue = Number(minPrice);
        const maxPriceValue = Number(maxPrice);
        if (Number.isFinite(minPriceValue) && minPrice !== '') {
            list = list.filter((product) => getProductPrice(product) >= minPriceValue);
        }
        if (Number.isFinite(maxPriceValue) && maxPrice !== '') {
            list = list.filter((product) => getProductPrice(product) <= maxPriceValue);
        }

        if (stockFilter === 'inStock') {
            list = list.filter((product) => isProductInStock(product));
        }

        if (bestSellerOnly) {
            list = list.filter((product) => isBestSeller(product));
        }

        if (ratingFilter !== 'all') {
            list = list.filter((product) => {
                const rating = getAverageRating(product);
                if (ratingFilter === '4plus') return rating >= 4;
                if (ratingFilter === '3plus') return rating >= 3;
                return true;
            });
        }

        if (reviewFilter !== 'all') {
            list = list.filter((product) => {
                const reviewCount = getReviewCount(product);
                if (reviewFilter === 'withReviews') return reviewCount > 0;
                if (reviewFilter === '10plus') return reviewCount >= 10;
                if (reviewFilter === '50plus') return reviewCount >= 50;
                return true;
            });
        }

        if (fastDeliveryOnly) {
            list = list.filter((product) => product?.fastDelivery === true);
        }

        list.sort((a, b) => {
            const priceA = getProductPrice(a);
            const priceB = getProductPrice(b);
            const dateA = new Date(a?.createdAt || 0).getTime();
            const dateB = new Date(b?.createdAt || 0).getTime();
            const nameA = String(a?.name || a?.title || '').toLowerCase();
            const nameB = String(b?.name || b?.title || '').toLowerCase();
            const ratingA = getAverageRating(a);
            const ratingB = getAverageRating(b);

            if (sortBy === 'priceLowToHigh') return priceA - priceB;
            if (sortBy === 'priceHighToLow') return priceB - priceA;
            if (sortBy === 'ratingHighToLow') return ratingB - ratingA;
            if (sortBy === 'reviewCountHighToLow') return getReviewCount(b) - getReviewCount(a);
            if (sortBy === 'nameAZ') return nameA.localeCompare(nameB);
            if (sortBy === 'nameZA') return nameB.localeCompare(nameA);
            return dateB - dateA; // newest
        });

        return list;
    }, [filteredProducts, priceFilter, minPrice, maxPrice, stockFilter, ratingFilter, reviewFilter, bestSellerOnly, fastDeliveryOnly, sortBy, getProductPrice, isProductInStock, getAverageRating, getReviewCount, isBestSeller]);

    const totalPages = Math.max(1, Math.ceil(visibleProducts.length / PRODUCTS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);

    const paginatedProducts = useMemo(() => {
        const start = (safePage - 1) * PRODUCTS_PER_PAGE;
        return visibleProducts.slice(start, start + PRODUCTS_PER_PAGE);
    }, [visibleProducts, safePage]);

    const updatePage = useCallback((nextPage) => {
        const params = new URLSearchParams(searchParams.toString());
        if (nextPage <= 1) {
            params.delete('page');
        } else {
            params.set('page', String(nextPage));
        }

        const query = params.toString();
        router.push(query ? `/shop?${query}` : '/shop', { scroll: false });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [router, searchParams]);

    const filterSignature = useMemo(() => JSON.stringify({
        search,
        categoryParam,
        sortBy,
        priceFilter,
        minPrice,
        maxPrice,
        stockFilter,
        ratingFilter,
        reviewFilter,
        bestSellerOnly,
        fastDeliveryOnly,
    }), [
        search,
        categoryParam,
        sortBy,
        priceFilter,
        minPrice,
        maxPrice,
        stockFilter,
        ratingFilter,
        reviewFilter,
        bestSellerOnly,
        fastDeliveryOnly,
    ]);
    const previousFilterSignatureRef = useRef(filterSignature);

    useEffect(() => {
        if (previousFilterSignatureRef.current === filterSignature) return;
        previousFilterSignatureRef.current = filterSignature;
        if (currentPage > 1) {
            updatePage(1);
        }
    }, [filterSignature, currentPage, updatePage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            updatePage(totalPages);
        }
    }, [currentPage, totalPages, updatePage]);

    const fastSellingProducts = useMemo(() => {
        const list = [...sourceProducts]
            .filter((product) => product && (product.slug || product._id || product.id))
            .sort((a, b) => {
                const ratingDiff = getReviewCount(b) - getReviewCount(a);
                if (ratingDiff !== 0) return ratingDiff;
                return getAverageRating(b) - getAverageRating(a);
            })
            .slice(0, 8);

        return list;
    }, [sourceProducts, getReviewCount, getAverageRating]);

    useEffect(() => {
        if (fastSellingProducts.length <= 1) return;

        const interval = setInterval(() => {
            setFastSellingIndex((prev) => (prev + 1) % fastSellingProducts.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [fastSellingProducts.length]);

    useEffect(() => {
        if (fastSellingIndex >= fastSellingProducts.length) {
            setFastSellingIndex(0);
        }
    }, [fastSellingProducts.length, fastSellingIndex]);

    // Get display title
    const pageTitle = useMemo(() => {
        if (search) return `Search: ${search}`;
        if (categoryParam) {
            return categoryParam.split('-').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        }
        return 'All Products';
    }, [search, categoryParam]);

    const resetFilters = useCallback(() => {
        setSortBy('newest');
        setPriceFilter('all');
        setMinPrice('');
        setMaxPrice('');
        setStockFilter('all');
        setRatingFilter('all');
        setReviewFilter('all');
        setBestSellerOnly(false);
        setFastDeliveryOnly(false);
    }, []);

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
                {/* Header */}
                <div className="mb-6 mt-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {pageTitle}
                    </h1>
                    <p className="text-gray-600">
                        {search ? `Results for "${search}"` : categoryParam ? `Browse ${pageTitle}` : 'Discover our complete product collection'}
                    </p>
                </div>

                {/* Products Grid - Full Width (No Sidebar) */}
                {!mounted || searchLoading || (categoryParam ? categoryLoading : (!search?.trim() && shopLoading)) ? (
                    <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mb-4"></div>
                        <p className="text-gray-500 text-lg">Loading products...</p>
                    </div>
                ) : (
                    <>
                        <div className="lg:hidden mb-3">
                            <button
                                type="button"
                                onClick={() => setShowMobileFilters(true)}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold shadow-sm"
                            >
                                <SlidersHorizontal size={16} /> Filters & Sort
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-3 lg:gap-4 items-start">
                            <aside className={`${showMobileFilters ? 'block' : 'hidden'} lg:block space-y-3 lg:sticky lg:top-24`}>
                            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                        <SlidersHorizontal size={14} className="text-gray-500" />
                                        Shop Filters
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            className="text-xs text-orange-600 hover:text-orange-700 font-semibold"
                                        >
                                            Reset
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowMobileFilters(false)}
                                            className="lg:hidden text-gray-500"
                                            aria-label="Close filters"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[11px] font-medium text-gray-500 mb-1.5 block">Sort</label>
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-orange-300"
                                        >
                                            <option value="newest">Newest</option>
                                            <option value="priceLowToHigh">Price: Low to High</option>
                                            <option value="priceHighToLow">Price: High to Low</option>
                                            <option value="ratingHighToLow">Rating: High to Low</option>
                                            <option value="reviewCountHighToLow">Most Reviewed</option>
                                            <option value="nameAZ">Name: A to Z</option>
                                            <option value="nameZA">Name: Z to A</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-medium text-gray-500 mb-1.5 block">Price Range</label>
                                        <select
                                            value={priceFilter}
                                            onChange={(e) => setPriceFilter(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-orange-300"
                                        >
                                            <option value="all">All</option>
                                            <option value="under499">Under AED499</option>
                                            <option value="500to999">AED500 - AED999</option>
                                            <option value="1000to1999">AED1000 - AED1999</option>
                                            <option value="2000plus">AED2000+</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-medium text-gray-500 mb-1.5 block">Custom Price</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                value={minPrice}
                                                onChange={(e) => setMinPrice(e.target.value)}
                                                placeholder="Min"
                                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-orange-300"
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                value={maxPrice}
                                                onChange={(e) => setMaxPrice(e.target.value)}
                                                placeholder="Max"
                                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-orange-300"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-medium text-gray-500 mb-1.5 block">Stock</label>
                                        <select
                                            value={stockFilter}
                                            onChange={(e) => setStockFilter(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-orange-300"
                                        >
                                            <option value="all">All</option>
                                            <option value="inStock">In Stock</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-medium text-gray-500 mb-1.5 block">Rating</label>
                                        <select
                                            value={ratingFilter}
                                            onChange={(e) => setRatingFilter(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-orange-300"
                                        >
                                            <option value="all">All</option>
                                            <option value="4plus">4★ & above</option>
                                            <option value="3plus">3★ & above</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-medium text-gray-500 mb-1.5 block">Reviews</label>
                                        <select
                                            value={reviewFilter}
                                            onChange={(e) => setReviewFilter(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-orange-300"
                                        >
                                            <option value="all">All</option>
                                            <option value="withReviews">With reviews</option>
                                            <option value="10plus">10+ reviews</option>
                                            <option value="50plus">50+ reviews</option>
                                        </select>
                                    </div>

                                    <label className="flex items-center gap-2 text-sm text-gray-700 px-1 py-1 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={bestSellerOnly}
                                            onChange={(e) => setBestSellerOnly(e.target.checked)}
                                            className="rounded border-gray-300"
                                        />
                                        Best Seller only
                                    </label>

                                    <label className="flex items-center gap-2 text-sm text-gray-700 px-1 py-1 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={fastDeliveryOnly}
                                            onChange={(e) => setFastDeliveryOnly(e.target.checked)}
                                            className="rounded border-gray-300"
                                        />
                                        Fast Delivery only
                                    </label>
                                </div>
                            </div>

                            {fastSellingProducts.length > 0 && (
                                <div className="bg-white border border-slate-300 rounded-md p-3 shadow-sm">
                                    <div className="mb-2">
                                        <h3 className="text-sm font-semibold text-slate-900 tracking-wide">Trending Pick</h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const product = fastSellingProducts[fastSellingIndex];
                                            if (!product) return;
                                            const target = getProductPath(product);
                                            router.push(target);
                                        }}
                                        className="group w-full text-left border border-slate-300 rounded-md overflow-hidden hover:border-slate-500 transition"
                                    >
                                        <div className="relative h-64 bg-slate-100 overflow-hidden">
                                            {fastSellingProducts[fastSellingIndex]?.images?.[0] ? (
                                                <img
                                                    src={fastSellingProducts[fastSellingIndex].images[0]}
                                                    alt={fastSellingProducts[fastSellingIndex].name || 'Product'}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : null}
                                            <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/70 to-transparent">
                                                <div className="inline-flex items-center px-2 py-1 rounded-sm bg-white text-gray-900 text-sm font-bold shadow-sm">
                                                    AED{getProductPrice(fastSellingProducts[fastSellingIndex] || {}).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            )}
                            </aside>

                            <div>
                                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                                    {visibleProducts.length > 0 ? (
                                        <>
                                            Showing {((safePage - 1) * PRODUCTS_PER_PAGE + 1).toLocaleString()}-
                                            {Math.min(safePage * PRODUCTS_PER_PAGE, visibleProducts.length).toLocaleString()} of {visibleProducts.length.toLocaleString()} {visibleProducts.length === 1 ? 'product' : 'products'}
                                        </>
                                    ) : (
                                        <>Showing 0 products</>
                                    )}
                                    {(bestSellerOnly || fastDeliveryOnly || reviewFilter !== 'all' || minPrice || maxPrice) && (
                                        <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-1">
                                            Advanced filters active
                                        </span>
                                    )}
                                </div>
                                {visibleProducts.length === 0 ? (
                                    <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
                                        <p className="text-gray-500 text-lg mb-2">No products found.</p>
                                        <p className="text-gray-400 text-sm mb-6">Try changing filters or reset all filters.</p>
                                        <button
                                            onClick={resetFilters}
                                            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                                        >
                                            Reset Filters
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 lg:grid-cols-5">
                                            {paginatedProducts.map((product) => (
                                                <ProductCard key={product._id || product.id} product={product} />
                                            ))}
                                        </div>
                                        <ShopPagination
                                            page={safePage}
                                            totalPages={totalPages}
                                            totalItems={visibleProducts.length}
                                            pageSize={PRODUCTS_PER_PAGE}
                                            onPageChange={updatePage}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function Shop() {
  return (
    <Suspense fallback={<div>Loading shop...</div>}>
      <ShopContent />
    </Suspense>
  );
}
