"use client";
import { Suspense, useMemo, useState, useCallback, useEffect, useRef } from "react";
import ProductCard from "@/components/ProductCard"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from '@/lib/useAuth'
import axios from 'axios'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { getProductPath } from '@/lib/productUrl'
import { getProductThumbnailUrl } from '@/lib/productMedia'
import { PLACEHOLDER_IMAGE } from '@/lib/mediaUrls'
import { decodeHtmlEntities } from '@/lib/displayText'

function buildCatalogUrl({
  search,
  selectedCategories,
  sortBy,
  priceFilter,
  minPrice,
  maxPrice,
  stockFilter,
  bestSellerOnly,
  fastDeliveryOnly,
}) {
  if (search?.trim()) {
    const params = new URLSearchParams({
      keyword: search.trim(),
      all: 'true',
      includeOutOfStock: 'true',
    });
    return `/api/search-products?${params}`;
  }

  const params = new URLSearchParams({
    all: 'true',
    slim: 'true',
    includeOutOfStock: 'true',
    sort: sortBy,
  });

  if (selectedCategories?.length) {
    params.set('categories', selectedCategories.join(','));
  }
  if (priceFilter !== 'all') params.set('priceFilter', priceFilter);
  if (minPrice) params.set('minPrice', minPrice);
  if (maxPrice) params.set('maxPrice', maxPrice);
  if (stockFilter === 'inStock') params.set('inStockOnly', 'true');
  if (bestSellerOnly) params.set('bestSeller', 'true');
  if (fastDeliveryOnly) params.set('fastDelivery', 'true');

  return `/api/products?${params}`;
}

function ShopContent() {
    const searchParams = useSearchParams();
    const search = searchParams.get('search');
    const selectedCategories = useMemo(() => {
        const multi = String(searchParams.get('categories') || '').trim();
        if (multi) {
            return multi.split(',').map((slug) => slug.trim()).filter(Boolean);
        }
        const single = String(searchParams.get('category') || '').trim();
        return single ? [single] : [];
    }, [searchParams]);
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [products, setProducts] = useState([]);
    const [totalProducts, setTotalProducts] = useState(0);
    const [productsLoading, setProductsLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [showCategories, setShowCategories] = useState(true);
    const [sortBy, setSortBy] = useState('newest');
    const [priceFilter, setPriceFilter] = useState('all');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [stockFilter, setStockFilter] = useState('all');
    const [bestSellerOnly, setBestSellerOnly] = useState(false);
    const [fastDeliveryOnly, setFastDeliveryOnly] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [fastSellingProducts, setFastSellingProducts] = useState([]);
    const [fastSellingIndex, setFastSellingIndex] = useState(0);
    const { user, getToken } = useAuth();
    const fetchAbortRef = useRef(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        let isActive = true;
        fetch('/api/categories')
            .then((res) => res.json())
            .then((data) => {
                if (!isActive) return;
                setCategories(Array.isArray(data?.categories) ? data.categories : []);
            })
            .catch(() => {
                if (!isActive) return;
                setCategories([]);
            });
        return () => {
            isActive = false;
        };
    }, []);

    useEffect(() => {
        let isActive = true;
        fetch('/api/products?paginated=true&slim=true&limit=8&page=1&includeOutOfStock=true')
            .then((res) => res.json())
            .then((data) => {
                if (!isActive) return;
                const list = Array.isArray(data?.products) ? data.products : [];
                setFastSellingProducts(list.filter((product) => product?.slug || product?._id));
            })
            .catch(() => {
                if (!isActive) return;
                setFastSellingProducts([]);
            });
        return () => {
            isActive = false;
        };
    }, []);

    useEffect(() => {
        if (!search || !search.trim()) return;

        const saveSearch = async () => {
            const trimmedSearch = search.trim();

            if (user) {
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
                try {
                    const existing = JSON.parse(localStorage.getItem('recentSearches') || '[]');
                    const filtered = existing.filter((item) => item !== trimmedSearch);
                    filtered.unshift(trimmedSearch);
                    localStorage.setItem('recentSearches', JSON.stringify(filtered.slice(0, 20)));
                } catch (error) {
                    console.error('Error saving search to localStorage:', error);
                }
            }
        };

        saveSearch();
    }, [search, user, getToken]);

    const catalogQueryKey = useMemo(() => JSON.stringify({
        search: search?.trim() || '',
        selectedCategories,
        sortBy,
        priceFilter,
        minPrice,
        maxPrice,
        stockFilter,
        bestSellerOnly,
        fastDeliveryOnly,
    }), [
        search,
        selectedCategories,
        sortBy,
        priceFilter,
        minPrice,
        maxPrice,
        stockFilter,
        bestSellerOnly,
        fastDeliveryOnly,
    ]);

    useEffect(() => {
        if (fetchAbortRef.current) {
            fetchAbortRef.current.abort();
        }

        const controller = new AbortController();
        fetchAbortRef.current = controller;
        setProductsLoading(true);

        const url = buildCatalogUrl({
            search,
            selectedCategories,
            sortBy,
            priceFilter,
            minPrice,
            maxPrice,
            stockFilter,
            bestSellerOnly,
            fastDeliveryOnly,
        });

        fetch(url, { signal: controller.signal })
            .then((res) => res.json())
            .then((data) => {
                if (controller.signal.aborted) return;
                const list = Array.isArray(data?.products) ? data.products : [];
                setProducts(list);
                setTotalProducts(Number(data?.total) || list.length);
            })
            .catch((error) => {
                if (controller.signal.aborted || error?.name === 'AbortError') return;
                setProducts([]);
                setTotalProducts(0);
            })
            .finally(() => {
                if (controller.signal.aborted) return;
                setProductsLoading(false);
            });

        return () => controller.abort();
    }, [catalogQueryKey, search, selectedCategories, sortBy, priceFilter, minPrice, maxPrice, stockFilter, bestSellerOnly, fastDeliveryOnly]);

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

    const rootCategories = useMemo(() => {
        return categories
            .filter((category) => !category?.parentId)
            .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
    }, [categories]);

    const categoryTitleMap = useMemo(() => {
        const map = new Map();
        const visit = (items = []) => {
            for (const category of items) {
                if (category?.slug) {
                    map.set(category.slug, decodeHtmlEntities(category.name || category.slug));
                }
                if (Array.isArray(category?.children) && category.children.length) {
                    visit(category.children);
                }
            }
        };
        visit(categories);
        return map;
    }, [categories]);

    const pageTitle = useMemo(() => {
        if (search) return `Search: ${search}`;
        if (selectedCategories.length === 1) {
            return categoryTitleMap.get(selectedCategories[0])
                || selectedCategories[0].split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
        if (selectedCategories.length > 1) {
            return `${selectedCategories.length} Categories`;
        }
        return 'All Products';
    }, [search, selectedCategories, categoryTitleMap]);

    const resetFilters = useCallback(() => {
        setSortBy('newest');
        setPriceFilter('all');
        setMinPrice('');
        setMaxPrice('');
        setStockFilter('all');
        setBestSellerOnly(false);
        setFastDeliveryOnly(false);

        const params = new URLSearchParams(searchParams.toString());
        params.delete('categories');
        params.delete('category');
        const query = params.toString();
        router.push(query ? `/shop?${query}` : '/shop');
    }, [router, searchParams]);

    const clearCategories = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('categories');
        params.delete('category');
        const query = params.toString();
        router.push(query ? `/shop?${query}` : '/shop');
    }, [router, searchParams]);

    const toggleCategory = useCallback((slug) => {
        const normalizedSlug = String(slug || '').trim();
        if (!normalizedSlug) return;

        const params = new URLSearchParams(searchParams.toString());
        params.delete('category');

        const next = selectedCategories.includes(normalizedSlug)
            ? selectedCategories.filter((item) => item !== normalizedSlug)
            : [...selectedCategories, normalizedSlug];

        if (next.length) {
            params.set('categories', next.join(','));
        } else {
            params.delete('categories');
        }

        const query = params.toString();
        router.push(query ? `/shop?${query}` : '/shop');
    }, [router, searchParams, selectedCategories]);

    const fastSellingProduct = fastSellingProducts[fastSellingIndex];
    const fastSellingImage = fastSellingProduct
        ? getProductThumbnailUrl(fastSellingProduct, { fallback: PLACEHOLDER_IMAGE })
        : PLACEHOLDER_IMAGE;

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
                <div className="mb-6 mt-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {pageTitle}
                    </h1>
                    <p className="text-gray-600">
                        {search
                            ? `Results for "${search}"`
                            : selectedCategories.length
                                ? `Browse ${pageTitle}`
                                : 'Discover our complete product collection'}
                    </p>
                </div>

                {!mounted || productsLoading ? (
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
                            {rootCategories.length > 0 && (
                                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setShowCategories((current) => !current)}
                                        className="flex w-full items-center justify-between text-sm font-semibold text-gray-800"
                                    >
                                        <span>Categories</span>
                                        <ChevronDown size={16} className={`transition ${showCategories ? '' : '-rotate-90'}`} />
                                    </button>
                                    {showCategories ? (
                                        <div className="mt-3 border-t border-slate-100 pt-3">
                                            <div className="max-h-[min(26rem,52vh)] overflow-y-auto overscroll-contain pr-1 space-y-1">
                                            <div className="mb-2 flex items-center justify-between gap-2 px-1">
                                                <span className="text-[11px] font-medium text-gray-500">
                                                    {selectedCategories.length
                                                        ? `${selectedCategories.length} selected`
                                                        : 'Select one or more'}
                                                </span>
                                                {selectedCategories.length > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={clearCategories}
                                                        className="text-[11px] font-semibold text-orange-600 hover:text-orange-700"
                                                    >
                                                        Clear
                                                    </button>
                                                ) : null}
                                            </div>
                                            {rootCategories.map((category) => {
                                                const slug = String(category?.slug || '').trim();
                                                const categoryId = String(category?._id || slug);
                                                const isSelected = Boolean(slug && selectedCategories.includes(slug));

                                                return (
                                                    <label
                                                        key={categoryId}
                                                        className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                                                            isSelected
                                                                ? 'bg-orange-50 text-orange-700'
                                                                : 'text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            disabled={!slug}
                                                            onChange={() => toggleCategory(slug)}
                                                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-300"
                                                        />
                                                        <span className={isSelected ? 'font-semibold' : ''}>
                                                            {decodeHtmlEntities(category?.name || slug || 'Category')}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}

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

                            {fastSellingProduct && (
                                <div className="bg-white border border-slate-300 rounded-md p-3 shadow-sm">
                                    <div className="mb-2">
                                        <h3 className="text-sm font-semibold text-slate-900 tracking-wide">Trending Pick</h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!fastSellingProduct) return;
                                            router.push(getProductPath(fastSellingProduct));
                                        }}
                                        className="group w-full text-left border border-slate-300 rounded-md overflow-hidden hover:border-slate-500 transition"
                                    >
                                        <div className="relative h-64 bg-slate-100 overflow-hidden">
                                            {fastSellingImage && fastSellingImage !== PLACEHOLDER_IMAGE ? (
                                                <img
                                                    src={fastSellingImage}
                                                    alt={fastSellingProduct.name || 'Product'}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : null}
                                            <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/70 to-transparent">
                                                <div className="inline-flex items-center px-2 py-1 rounded-sm bg-white text-gray-900 text-sm font-bold shadow-sm">
                                                    AED{getProductPrice(fastSellingProduct).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            )}
                            </aside>

                            <div>
                                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                                    {totalProducts > 0 ? (
                                        <>
                                            Showing {totalProducts.toLocaleString()} {totalProducts === 1 ? 'product' : 'products'}
                                        </>
                                    ) : (
                                        <>Showing 0 products</>
                                    )}
                                    {(bestSellerOnly || fastDeliveryOnly || minPrice || maxPrice || priceFilter !== 'all' || selectedCategories.length > 0) && (
                                        <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-1">
                                            Filters active
                                        </span>
                                    )}
                                </div>
                                {products.length === 0 ? (
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
                                            {products.map((product) => (
                                                <ProductCard key={product._id || product.id} product={product} />
                                            ))}
                                        </div>
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
