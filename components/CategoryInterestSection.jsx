'use client';

import { useMemo, useState, useEffect } from 'react';
import { PackageOpen, Loader2 } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import {
  HOME_SECTION_CLASS,
  HOME_SECTION_BLOCK_HEADING_CLASS,
  HOME_SECTION_GRID_INNER_CLASS,
  MOBILE_SECTION_FULL_BLEED_CLASS,
  HOME_PRODUCT_GRID_CLASS,
} from '@/lib/storefrontCarousel';
import { cleanDisplayText } from '@/lib/displayText';
import { getLocalizedCategoryName } from '@/lib/categoryLocalization';
import { getProductThumbnailUrl } from '@/lib/productMedia';
import { PLACEHOLDER_IMAGE } from '@/lib/mediaUrls';
import {
  MANUAL_RECOMMENDED_MAX,
  RECOMMENDED_HOME_INITIAL,
  RECOMMENDED_HOME_SHOW_MORE_STEP,
  fetchProductsByIdsInOrder,
} from '@/lib/recommendedProductCatalog';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';
import CategoryChipScroller from '@/components/CategoryChipScroller';
import { HomeExploreInterestsSkeleton } from '@/components/home/HomeSectionSkeletons';

const MAX_CATEGORIES = 10;
const MAX_CATEGORY_PRODUCTS = 60;
const RECOMMENDED_CATALOG_LIMIT = RECOMMENDED_HOME_INITIAL;

function getFullRowDisplayLimit(requestedCount, totalCount, columnsPerRow) {
  if (totalCount <= 0 || columnsPerRow <= 0) return 0;

  const capped = Math.min(requestedCount, totalCount);
  // Last batch: show every remaining product (may be a short final row).
  if (capped >= totalCount) return totalCount;

  const fullRowLimit = Math.floor(capped / columnsPerRow) * columnsPerRow;
  if (fullRowLimit > 0) return fullRowLimit;

  return Math.min(totalCount, columnsPerRow);
}

function ExploreInterestsProductSkeleton({ count = 6 }) {
  return Array.from({ length: count }).map((_, index) => (
    <div
      key={`interest-skeleton-${index}`}
      className="h-full w-full min-w-0 overflow-hidden rounded-[2px] border border-gray-100 bg-white animate-pulse"
    >
      <div className="aspect-square w-full bg-gray-100" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-4/5 rounded bg-gray-100" />
        <div className="h-4 w-1/2 rounded bg-gray-100" />
      </div>
    </div>
  ));
}

const LOAD_MORE_DELAY_MS = 450;

function getColumnsForWidth(width) {
  if (width >= 1024) return 6;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

function normalizeCategory(value) {
  return cleanDisplayText(value);
}

function normalizeToken(value) {
  return normalizeCategory(value).toLowerCase();
}

function isRootParentCategory(category) {
  const parentId = category?.parentId;
  if (parentId === null || parentId === undefined) return true;
  const normalized = String(parentId).trim().toLowerCase();
  return !normalized || normalized === 'null' || normalized === '0';
}

function isDisplayableCategoryName(name) {
  const label = normalizeCategory(name);
  if (!label || label.length < 2) return false;
  if (/^\d+$/.test(label)) return false;
  if (/^[a-f0-9]{24}$/i.test(label)) return false;
  return true;
}

function normalizeCategoryId(value) {
  return String(value || '').trim().toLowerCase();
}

function collectDescendantCategoryIds(rootId, childrenByParentId) {
  const root = normalizeCategoryId(rootId);
  const ids = new Set([root]);
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    const children = childrenByParentId.get(current) || [];
    children.forEach((childId) => {
      const normalized = normalizeCategoryId(childId);
      if (!ids.has(normalized)) {
        ids.add(normalized);
        queue.push(normalized);
      }
    });
  }

  return ids;
}

function buildCategoryTreeMaps(categories = []) {
  const childrenByParentId = new Map();

  categories.forEach((category) => {
    const parentKey = category?.parentId ? normalizeCategoryId(category.parentId) : '';
    if (!parentKey) return;

    const childId = normalizeCategoryId(category._id);
    if (!childrenByParentId.has(parentKey)) {
      childrenByParentId.set(parentKey, []);
    }
    childrenByParentId.get(parentKey).push(childId);
  });

  return { childrenByParentId };
}

function getProductCategoryCandidates(product) {
  const values = [];

  const pushValue = (value) => {
    const normalized = normalizeCategoryId(value);
    if (normalized) {
      values.push(normalized);
    }
  };

  const pushMaybeObject = (value) => {
    if (!value) return;

    if (typeof value === 'object') {
      pushValue(value?._id);
      pushValue(value?.name);
      pushValue(value?.slug);
      return;
    }

    pushValue(value);
  };

  pushMaybeObject(product?.category);
  pushValue(product?.categoryName);
  pushValue(product?.subcategory);

  if (Array.isArray(product?.categories)) {
    product.categories.forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        pushValue(item?._id);
        pushValue(item?.name);
        pushValue(item?.slug);
        return;
      }
      pushValue(item);
    });
  }

  return Array.from(new Set(values));
}

const normalizeImages = (images) => {
  if (Array.isArray(images)) {
    return images.filter((img) => {
      if (typeof img === 'string') return img.trim().length > 0;
      if (typeof img === 'object' && img !== null) {
        return img.url || img.src || img.path || img.data || false;
      }
      return false;
    });
  }

  if (images === null || images === undefined) return [];

  if (typeof images === 'object') {
    if (images.url || images.src || images.path || images.data) {
      return [images];
    }
    return [];
  }

  if (typeof images === 'string') {
    return images.trim().length > 0 ? [images] : [];
  }

  return [];
};

function isRenderableProduct(product) {
  if (!product || typeof product !== 'object') return false;
  if (!product.name || !product.slug) return false;
  const thumbnail = getProductThumbnailUrl(product, { fallback: PLACEHOLDER_IMAGE });
  return Boolean(thumbnail && thumbnail !== PLACEHOLDER_IMAGE);
}

function sortByLatest(products) {
  return [...products].sort((left, right) => {
    const leftTime = new Date(left?.createdAt || 0).getTime();
    const rightTime = new Date(right?.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

export default function CategoryInterestSection() {
  const { t, language, isArabic } = useStorefrontI18n();
  const [apiCategories, setApiCategories] = useState([]);
  const [categoryChildrenByParentId, setCategoryChildrenByParentId] = useState(new Map());
  const [sectionEnabled, setSectionEnabled] = useState(true);
  const [manualRecommendedIds, setManualRecommendedIds] = useState([]);
  const [manualRecommendedProducts, setManualRecommendedProducts] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [categoryCatalogProducts, setCategoryCatalogProducts] = useState([]);
  const [categoryCatalogLoaded, setCategoryCatalogLoaded] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [manualRecommendedLoading, setManualRecommendedLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [categoryDataLoading, setCategoryDataLoading] = useState(false);
  const [columnsPerRow, setColumnsPerRow] = useState(6);
  const [visibleProductCount, setVisibleProductCount] = useState(RECOMMENDED_HOME_INITIAL);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const updateColumns = () => {
      setColumnsPerRow(getColumnsForWidth(window.innerWidth));
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const latestProducts = useMemo(
    () => sortByLatest(catalogProducts.filter(isRenderableProduct)).slice(0, MANUAL_RECOMMENDED_MAX),
    [catalogProducts]
  );

  const [selectedCategoryKey, setSelectedCategoryKey] = useState('recommended');
  const isRecommendedTab = selectedCategoryKey === 'recommended';

  useEffect(() => {
    let isActive = true;

    const fetchExploreInterestsSettings = async () => {
      try {
        const response = await fetch('/api/store/explore-interests/public').catch(() => null);
        if (!response?.ok || !isActive) return;

        const data = await response.json();
        if (!isActive) return;

        const ids = Array.isArray(data?.productIds)
          ? data.productIds.map((id) => String(id || '').trim()).filter(Boolean)
          : [];

        setSectionEnabled(typeof data?.enabled === 'boolean' ? data.enabled : true);
        setManualRecommendedIds(ids);
      } catch {
        // Settings failure falls back to automatic catalog below.
      } finally {
        if (isActive) setSettingsLoaded(true);
      }
    };

    fetchExploreInterestsSettings();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleLiveUpdate = (event) => {
      const payload = event?.detail;
      if (!payload || typeof payload !== 'object') return;

      setSectionEnabled(typeof payload.enabled === 'boolean' ? payload.enabled : true);
      setManualRecommendedIds(
        Array.isArray(payload.productIds)
          ? payload.productIds.map((id) => String(id || '').trim()).filter(Boolean)
          : []
      );
    };

    window.addEventListener('exploreInterestsUpdated', handleLiveUpdate);
    return () => {
      window.removeEventListener('exploreInterestsUpdated', handleLiveUpdate);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadRecommendedCatalog = async () => {
      setCatalogLoading(true);

      try {
        const response = await fetch(`/api/products?limit=${RECOMMENDED_CATALOG_LIMIT}&slim=true`);
        if (!response.ok || !isActive) return;

        const data = await response.json();
        if (!isActive) return;

        const products = Array.isArray(data?.products)
          ? data.products
          : Array.isArray(data)
            ? data
            : [];

        setCatalogProducts(products.filter(isRenderableProduct));
      } catch {
        if (isActive) setCatalogProducts([]);
      } finally {
        if (isActive) setCatalogLoading(false);
      }
    };

    loadRecommendedCatalog();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const fetchManualProducts = async () => {
      if (!Array.isArray(manualRecommendedIds) || manualRecommendedIds.length === 0) {
        setManualRecommendedProducts([]);
        setManualRecommendedLoading(false);
        return;
      }

      const idsToFetch = manualRecommendedIds.slice(0, MANUAL_RECOMMENDED_MAX);
      const loadedIds = new Set(
        manualRecommendedProducts.map((product) => String(product?._id || product?.id || ''))
      );
      const missingIds = idsToFetch.filter((id) => !loadedIds.has(String(id)));

      if (missingIds.length === 0) {
        setManualRecommendedLoading(false);
        return;
      }

      setManualRecommendedLoading(true);

      try {
        const normalized = await fetchProductsByIdsInOrder(missingIds);
        if (!isActive) return;

        setManualRecommendedProducts((previous) => {
          const productMap = new Map(
            previous.map((product) => [String(product?._id || product?.id || ''), product])
          );
          normalized.forEach((product) => {
            productMap.set(String(product?._id || product?.id || ''), product);
          });

          return manualRecommendedIds
            .slice(0, MANUAL_RECOMMENDED_MAX)
            .map((id) => productMap.get(String(id)))
            .filter(isRenderableProduct);
        });
      } catch {
        if (isActive) setManualRecommendedProducts([]);
      } finally {
        if (isActive) setManualRecommendedLoading(false);
      }
    };

    fetchManualProducts();

    return () => {
      isActive = false;
    };
  }, [manualRecommendedIds]);

  useEffect(() => {
    let isActive = true;

    const fetchParentCategories = async () => {
      try {
        const response = await fetch('/api/categories', { next: { revalidate: 300 } });
        if (!response.ok || !isActive) return;

        const data = await response.json();
        if (!isActive) return;

        const categoryList = Array.isArray(data?.categories) ? data.categories : [];
        const { childrenByParentId } = buildCategoryTreeMaps(categoryList);

        const normalized = categoryList
          .filter((cat) => cat && isRootParentCategory(cat) && isDisplayableCategoryName(cat.name))
          .map((cat) => ({
            key: `api:${String(cat._id || cat.slug || cat.name)}`,
            label: normalizeCategory(cat.name),
            nameAr: normalizeCategory(cat.nameAr),
            id: String(cat._id || ''),
            slug: normalizeToken(cat.slug),
          }))
          .sort((left, right) => left.label.localeCompare(right.label));

        setCategoryChildrenByParentId(childrenByParentId);
        setApiCategories(normalized.slice(0, MAX_CATEGORIES));
      } catch {
        // Chips fall back to Recommended only if categories fail to load.
      }
    };

    fetchParentCategories();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (isRecommendedTab || categoryCatalogLoaded) return undefined;

    let isActive = true;

    const loadCategoryProducts = async () => {
      setCategoryDataLoading(true);

      try {
        const response = await fetch(`/api/products?limit=${MAX_CATEGORY_PRODUCTS}&slim=true`);
        if (!response.ok || !isActive) return;

        const data = await response.json();
        if (!isActive) return;

        const products = Array.isArray(data?.products)
          ? data.products
          : Array.isArray(data)
            ? data
            : [];

        setCategoryCatalogProducts(products.filter(isRenderableProduct));
        setCategoryCatalogLoaded(true);
      } catch {
        // Category tab can retry on next selection.
      } finally {
        if (isActive) setCategoryDataLoading(false);
      }
    };

    loadCategoryProducts();

    return () => {
      isActive = false;
    };
  }, [isRecommendedTab, categoryCatalogLoaded]);

  const categoriesToRender = useMemo(() => {
    return [
      {
        key: 'recommended',
        label: t('exploreInterests.recommended'),
        matchName: null,
        id: null,
        slug: null,
      },
      ...apiCategories.map((category) => ({
        ...category,
        matchName: category.label,
        label: getLocalizedCategoryName(
          { name: category.label, nameAr: category.nameAr, slug: category.slug },
          language,
        ),
      })),
    ];
  }, [apiCategories, language, t]);

  const selectedCategoryOption = useMemo(() => {
    return categoriesToRender.find((category) => category.key === selectedCategoryKey) || categoriesToRender[0];
  }, [categoriesToRender, selectedCategoryKey]);

  useEffect(() => {
    const exists = categoriesToRender.some((category) => category.key === selectedCategoryKey);
    if (!exists) {
      setSelectedCategoryKey('recommended');
    }
  }, [categoriesToRender, selectedCategoryKey]);

  useEffect(() => {
    setVisibleProductCount(RECOMMENDED_HOME_INITIAL);
    setLoadingMore(false);
  }, [selectedCategoryKey]);

  useEffect(() => {
    if (!loadingMore || manualRecommendedLoading) return undefined;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        setVisibleProductCount((current) => current + RECOMMENDED_HOME_SHOW_MORE_STEP);
        setLoadingMore(false);
      }
    }, LOAD_MORE_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadingMore, manualRecommendedLoading]);

  const tabProducts = useMemo(() => {
    if (!selectedCategoryOption || selectedCategoryOption.key === 'recommended') {
      if (manualRecommendedProducts.length > 0) {
        return manualRecommendedProducts.slice(0, MANUAL_RECOMMENDED_MAX);
      }
      return latestProducts;
    }

    const selectedLabel = normalizeToken(selectedCategoryOption.matchName || selectedCategoryOption.label);
    const selectedId = normalizeCategoryId(selectedCategoryOption.id);
    const selectedSlug = normalizeToken(selectedCategoryOption.slug);
    const matchCategoryIds = selectedId
      ? collectDescendantCategoryIds(selectedId, categoryChildrenByParentId)
      : new Set();

    return categoryCatalogProducts
      .filter((product) => {
        const candidates = getProductCategoryCandidates(product);
        if (candidates.length === 0) return false;

        if (selectedId) {
          return candidates.some((candidate) => matchCategoryIds.has(normalizeCategoryId(candidate)));
        }
        if (selectedSlug && candidates.includes(selectedSlug)) return true;
        if (selectedLabel && candidates.includes(selectedLabel)) return true;

        return false;
      })
      .slice(0, MAX_CATEGORY_PRODUCTS);
  }, [
    categoryCatalogProducts,
    selectedCategoryOption,
    categoryChildrenByParentId,
    manualRecommendedProducts,
    latestProducts,
    manualRecommendedIds,
  ]);

  const displayLimit = useMemo(
    () => getFullRowDisplayLimit(visibleProductCount, tabProducts.length, columnsPerRow),
    [visibleProductCount, tabProducts.length, columnsPerRow]
  );

  const displayedProducts = useMemo(
    () => tabProducts.slice(0, displayLimit),
    [tabProducts, displayLimit]
  );

  const showMoreProducts = displayLimit < tabProducts.length;

  const loadMoreSkeletonCount = Math.min(columnsPerRow * 2, 12);

  const handleShowMore = () => {
    if (loadingMore || !showMoreProducts) return;
    setLoadingMore(true);
  };

  const recommendedStillLoading =
    isRecommendedTab &&
    (!settingsLoaded ||
      manualRecommendedLoading ||
      (manualRecommendedProducts.length === 0 && catalogLoading));

  if (!sectionEnabled) {
    return null;
  }

  if (recommendedStillLoading && displayedProducts.length === 0) {
    return <HomeExploreInterestsSkeleton productCount={columnsPerRow} />;
  }

  if (!isRecommendedTab && categoryDataLoading && displayedProducts.length === 0) {
    return <HomeExploreInterestsSkeleton productCount={columnsPerRow} />;
  }

  return (
    <section className={HOME_SECTION_CLASS}>
      <div className={HOME_SECTION_GRID_INNER_CLASS}>
        <div className="mb-4 sm:mb-5">
          <h2 className={`${HOME_SECTION_BLOCK_HEADING_CLASS} text-start`}>
            {t('exploreInterests.title')}
          </h2>
        </div>

        <div className={MOBILE_SECTION_FULL_BLEED_CLASS}>
          <CategoryChipScroller
            items={categoriesToRender}
            activeKey={selectedCategoryKey}
            onSelect={setSelectedCategoryKey}
            isRtl={isArabic}
            ariaLabel={t('exploreInterests.categoriesAria')}
            scrollLeftLabel={t('exploreInterests.scrollLeft')}
            scrollRightLabel={t('exploreInterests.scrollRight')}
          />
        </div>

        {(recommendedStillLoading || (!isRecommendedTab && categoryDataLoading)) && displayedProducts.length === 0 ? (
          <div className={`${MOBILE_SECTION_FULL_BLEED_CLASS} mt-5`}>
            <div className={HOME_PRODUCT_GRID_CLASS}>
              <ExploreInterestsProductSkeleton count={columnsPerRow} />
            </div>
          </div>
        ) : displayedProducts.length > 0 ? (
          <div className={`${MOBILE_SECTION_FULL_BLEED_CLASS} mt-5`}>
            <div className={HOME_PRODUCT_GRID_CLASS}>
            {displayedProducts.map((product, index) => (
              <ProductCard
                key={product._id || product.id || product.slug}
                product={product}
                priorityImages={index < 6}
              />
            ))}
            </div>
            {loadingMore ? (
              <div className={`${HOME_PRODUCT_GRID_CLASS} mt-3 sm:mt-4`}>
                <ExploreInterestsProductSkeleton count={loadMoreSkeletonCount} />
              </div>
            ) : null}
            {showMoreProducts || loadingMore ? (
              <div className="mt-6 flex justify-center sm:mt-8">
                <button
                  type="button"
                  onClick={handleShowMore}
                  disabled={loadingMore}
                  aria-busy={loadingMore}
                  className="inline-flex min-w-[9.5rem] items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      {t('exploreInterests.loadingMore')}
                    </>
                  ) : (
                    t('exploreInterests.loadMore')
                  )}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
              <PackageOpen size={28} className="text-slate-400" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-slate-600">{t('exploreInterests.emptyTitle')}</p>
            <p className="mt-1 text-xs text-slate-400">{t('exploreInterests.emptySubtitle')}</p>
          </div>
        )}
      </div>
    </section>
  );
}
