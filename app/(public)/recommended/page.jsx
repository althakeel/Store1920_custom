'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { decodeHtmlEntities } from '@/lib/displayText';
import { getLocalizedCategoryName } from '@/lib/categoryLocalization';
import { getProductPath } from '@/lib/productUrl';
import { getProductThumbnailUrl } from '@/lib/productMedia';
import { PLACEHOLDER_IMAGE } from '@/lib/mediaUrls';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';
import {
  RECOMMENDED_PAGE_SIZE,
  buildCategoryIndex,
  fetchProductsByIdsInOrder,
  filterRecommendedProducts,
  getProductDisplayPrice,
  paginateProducts,
  sortRecommendedProducts,
} from '@/lib/recommendedProductCatalog';

function RecommendedContent() {
  const router = useRouter();
  const { t, language, isArabic } = useStorefrontI18n();
  const locale = isArabic ? 'ar-AE' : 'en';

  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionEnabled, setSectionEnabled] = useState(true);
  const [categories, setCategories] = useState([]);
  const [showCategories, setShowCategories] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortBy, setSortBy] = useState('newest');
  const [priceFilter, setPriceFilter] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [bestSellerOnly, setBestSellerOnly] = useState(false);
  const [fastDeliveryOnly, setFastDeliveryOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [fastSellingIndex, setFastSellingIndex] = useState(0);

  useEffect(() => {
    let isActive = true;

    const loadRecommended = async () => {
      setLoading(true);
      try {
        const settingsRes = await fetch('/api/store/explore-interests/public', { cache: 'no-store' });
        const settings = settingsRes.ok ? await settingsRes.json() : null;
        const enabled = typeof settings?.enabled === 'boolean' ? settings.enabled : true;
        const productIds = Array.isArray(settings?.productIds) ? settings.productIds : [];

        if (!isActive) return;
        setSectionEnabled(enabled);

        if (!enabled || productIds.length === 0) {
          setAllProducts([]);
          return;
        }

        const products = await fetchProductsByIdsInOrder(productIds);
        if (!isActive) return;
        setAllProducts(products);
      } catch {
        if (isActive) {
          setAllProducts([]);
        }
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadRecommended();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    fetch('/api/categories', { credentials: 'same-origin', cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!isActive) return;
        setCategories(Array.isArray(data?.categories) ? data.categories : []);
      })
      .catch(() => {
        if (isActive) setCategories([]);
      });

    return () => {
      isActive = false;
    };
  }, [language]);

  const categoryIndex = useMemo(() => buildCategoryIndex(categories), [categories]);

  const localizeCategoryName = useCallback((category) => {
    if (!category) return '';
    return decodeHtmlEntities(getLocalizedCategoryName(category, language));
  }, [language]);

  const rootCategories = useMemo(() => {
    return categories
      .filter((category) => !category?.parentId)
      .sort((a, b) => localizeCategoryName(a).localeCompare(localizeCategoryName(b), locale));
  }, [categories, localizeCategoryName, locale]);

  const filterQueryKey = useMemo(() => JSON.stringify({
    selectedCategories,
    sortBy,
    priceFilter,
    minPrice,
    maxPrice,
    stockFilter,
    bestSellerOnly,
    fastDeliveryOnly,
  }), [
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
    setPage(1);
  }, [filterQueryKey]);

  const filteredProducts = useMemo(() => {
    const filtered = filterRecommendedProducts(allProducts, {
      selectedCategories,
      priceFilter,
      minPrice,
      maxPrice,
      stockFilter,
      bestSellerOnly,
      fastDeliveryOnly,
    }, categoryIndex);
    return sortRecommendedProducts(filtered, sortBy);
  }, [
    allProducts,
    selectedCategories,
    priceFilter,
    minPrice,
    maxPrice,
    stockFilter,
    bestSellerOnly,
    fastDeliveryOnly,
    sortBy,
    categoryIndex,
  ]);

  const pagination = useMemo(
    () => paginateProducts(filteredProducts, page, RECOMMENDED_PAGE_SIZE),
    [filteredProducts, page]
  );

  const { items: pageProducts, total: totalProducts, totalPages, page: currentPage } = pagination;

  const fastSellingProducts = useMemo(() => {
    if (currentPage !== 1 || loading || !pageProducts.length) return [];
    return pageProducts.slice(0, 8).filter((product) => product?.slug || product?._id);
  }, [currentPage, loading, pageProducts]);

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

  const resetFilters = useCallback(() => {
    setSortBy('newest');
    setPriceFilter('all');
    setMinPrice('');
    setMaxPrice('');
    setStockFilter('all');
    setBestSellerOnly(false);
    setFastDeliveryOnly(false);
    setSelectedCategories([]);
    setPage(1);
  }, []);

  const toggleCategory = useCallback((slug) => {
    const normalizedSlug = String(slug || '').trim();
    if (!normalizedSlug) return;

    setSelectedCategories((current) => (
      current.includes(normalizedSlug)
        ? current.filter((item) => item !== normalizedSlug)
        : [...current, normalizedSlug]
    ));
  }, []);

  const clearCategories = useCallback(() => {
    setSelectedCategories([]);
  }, []);

  const goToPage = useCallback((nextPage) => {
    const safePage = Math.max(1, Math.min(nextPage, totalPages));
    setPage(safePage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [totalPages]);

  const fastSellingProduct = fastSellingProducts[fastSellingIndex];
  const fastSellingImage = fastSellingProduct
    ? getProductThumbnailUrl(fastSellingProduct, { fallback: PLACEHOLDER_IMAGE })
    : PLACEHOLDER_IMAGE;

  const showingFrom = totalProducts > 0 ? ((currentPage - 1) * RECOMMENDED_PAGE_SIZE) + 1 : 0;
  const showingTo = totalProducts > 0 ? Math.min(currentPage * RECOMMENDED_PAGE_SIZE, totalProducts) : 0;

  const filtersActive = bestSellerOnly
    || fastDeliveryOnly
    || minPrice
    || maxPrice
    || priceFilter !== 'all'
    || selectedCategories.length > 0
    || stockFilter !== 'all';

  if (!loading && !sectionEnabled) {
    return (
      <div className="min-h-screen bg-white" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-lg font-medium text-gray-700">{t('recommended.emptyTitle')}</p>
          <p className="mt-2 text-sm text-gray-500">{t('recommended.emptySubtitle')}</p>
          <button
            type="button"
            onClick={() => router.push('/shop')}
            className="mt-6 rounded-lg bg-orange-500 px-6 py-2 text-white transition hover:bg-orange-600"
          >
            {t('recommended.browseShop')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        <div className={`mb-6 mt-6 ${isArabic ? 'text-right' : ''}`}>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {t('recommended.eyebrow')}
          </span>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            {t('recommended.title')}
          </h1>
          <p className="mt-2 text-gray-600">
            {t('recommended.subtitle')}
          </p>
        </div>

        <div className="lg:hidden mb-3">
          <button
            type="button"
            onClick={() => setShowMobileFilters(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm"
          >
            <SlidersHorizontal size={16} /> {t('category.filtersAndSort')}
          </button>
        </div>

        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[250px_1fr] lg:gap-4">
          <aside className={`${showMobileFilters ? 'block' : 'hidden'} space-y-3 lg:block lg:sticky lg:top-24`}>
            {rootCategories.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowCategories((current) => !current)}
                  className="flex w-full items-center justify-between text-sm font-semibold text-gray-800"
                >
                  <span>{t('shop.categories')}</span>
                  <ChevronDown size={16} className={`transition ${showCategories ? '' : '-rotate-90'}`} />
                </button>
                {showCategories ? (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <div className={`max-h-[min(26rem,52vh)] space-y-1 overflow-y-auto overscroll-contain ${isArabic ? 'pl-1' : 'pr-1'}`}>
                      <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <span className="text-[11px] font-medium text-gray-500">
                          {selectedCategories.length
                            ? t('shop.selectedCount', { count: selectedCategories.length })
                            : t('shop.selectOneOrMore')}
                        </span>
                        {selectedCategories.length > 0 ? (
                          <button
                            type="button"
                            onClick={clearCategories}
                            className="text-[11px] font-semibold text-orange-600 hover:text-orange-700"
                          >
                            {t('shop.clear')}
                          </button>
                        ) : null}
                      </div>
                      {rootCategories.map((category) => {
                        const slug = String(category?.slug || '').trim();
                        const categoryId = String(category?._id || slug);
                        const isSelected = Boolean(slug && selectedCategories.includes(slug));
                        const categoryLabel = localizeCategoryName(category) || slug || t('category.category');

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
                              {categoryLabel}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <SlidersHorizontal size={14} className="text-gray-500" />
                  {t('recommended.filtersTitle')}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                  >
                    {t('shop.reset')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMobileFilters(false)}
                    className="text-gray-500 lg:hidden"
                    aria-label={t('category.closeFilters')}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-gray-500">{t('shop.sort')}</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
                  >
                    <option value="newest">{t('category.sort.newest')}</option>
                    <option value="priceLowToHigh">{t('category.sort.priceLowHigh')}</option>
                    <option value="priceHighToLow">{t('category.sort.priceHighLow')}</option>
                    <option value="nameAZ">{t('shop.sort.nameAZ')}</option>
                    <option value="nameZA">{t('shop.sort.nameZA')}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-gray-500">{t('category.priceRange')}</label>
                  <select
                    value={priceFilter}
                    onChange={(e) => setPriceFilter(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
                  >
                    <option value="all">{t('shop.all')}</option>
                    <option value="under499">{t('shop.price.under499')}</option>
                    <option value="500to999">{t('shop.price.500to999')}</option>
                    <option value="1000to1999">{t('shop.price.1000to1999')}</option>
                    <option value="2000plus">{t('shop.price.2000plus')}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-gray-500">{t('shop.customPrice')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder={t('category.min')}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
                    />
                    <input
                      type="number"
                      min="0"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder={t('category.max')}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-gray-500">{t('shop.stock')}</label>
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
                  >
                    <option value="all">{t('shop.all')}</option>
                    <option value="inStock">{t('category.inStockOnly')}</option>
                  </select>
                </div>

                <label className="flex cursor-pointer items-center gap-2 px-1 py-1 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={bestSellerOnly}
                    onChange={(e) => setBestSellerOnly(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  {t('shop.bestSellerOnly')}
                </label>

                <label className="flex cursor-pointer items-center gap-2 px-1 py-1 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={fastDeliveryOnly}
                    onChange={(e) => setFastDeliveryOnly(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  {t('shop.fastDeliveryOnly')}
                </label>
              </div>
            </div>

            {fastSellingProduct && (
              <div className="rounded-md border border-slate-300 bg-white p-3 shadow-sm">
                <div className="mb-2">
                  <h3 className="text-sm font-semibold tracking-wide text-slate-900">{t('shop.trendingPick')}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(getProductPath(fastSellingProduct))}
                  className={`group w-full overflow-hidden rounded-md border border-slate-300 transition hover:border-slate-500 ${isArabic ? 'text-right' : 'text-left'}`}
                >
                  <div className="relative h-64 overflow-hidden bg-slate-100">
                    {fastSellingImage && fastSellingImage !== PLACEHOLDER_IMAGE ? (
                      <img
                        src={fastSellingImage}
                        alt={fastSellingProduct.name || t('common.product')}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                    <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 ${isArabic ? 'text-right' : ''}`}>
                      <div className="inline-flex items-center rounded-sm bg-white px-2 py-1 text-sm font-bold text-gray-900 shadow-sm">
                        AED{getProductDisplayPrice(fastSellingProduct).toLocaleString(locale)}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </aside>

          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              {loading ? (
                <>{t('recommended.loading')}</>
              ) : totalProducts > 0 ? (
                <>
                  {t('shop.showingRange', {
                    from: showingFrom.toLocaleString(locale),
                    to: showingTo.toLocaleString(locale),
                    total: totalProducts.toLocaleString(locale),
                    label: totalProducts === 1 ? t('shop.productSingular') : t('shop.productPlural'),
                  })}
                </>
              ) : (
                <>{t('shop.showingZero')}</>
              )}
              {filtersActive && (
                <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-xs text-orange-700">
                  {t('shop.filtersActive')}
                </span>
              )}
            </div>

            {loading ? (
              <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
                <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-orange-500" />
                <p className="text-lg text-gray-500">{t('recommended.loading')}</p>
              </div>
            ) : pageProducts.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
                <p className="mb-2 text-lg text-gray-500">
                  {allProducts.length === 0 ? t('recommended.emptyTitle') : t('shop.noProductsFound')}
                </p>
                <p className="mb-6 text-sm text-gray-400">
                  {allProducts.length === 0 ? t('recommended.emptySubtitle') : t('shop.tryChangingFilters')}
                </p>
                <button
                  type="button"
                  onClick={allProducts.length === 0 ? () => router.push('/shop') : resetFilters}
                  className="rounded-lg bg-orange-500 px-6 py-2 text-white transition hover:bg-orange-600"
                >
                  {allProducts.length === 0 ? t('recommended.browseShop') : t('category.clearFilters')}
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 lg:grid-cols-5">
                  {pageProducts.map((product, index) => (
                    <ProductCard
                      key={product._id || product.id || product.slug}
                      product={product}
                      priorityImages={currentPage === 1 && index < 6}
                    />
                  ))}
                </div>
                {totalPages > 1 ? (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('shop.previous')}
                    </button>
                    <span className="px-3 text-sm text-gray-600">
                      {t('shop.pageOf', { page: currentPage, total: totalPages })}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('shop.next')}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RecommendedPage() {
  const { t } = useStorefrontI18n();

  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">{t('recommended.loadingPage')}</div>}>
      <RecommendedContent />
    </Suspense>
  );
}
