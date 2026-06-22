'use client';

import { useMemo, useState, useEffect } from 'react';
import { PackageOpen } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import {
  HOME_PRODUCT_GRID_CLASS,
  HOME_SECTION_CLASS,
  HOME_SECTION_BLOCK_HEADING_CLASS,
  HOME_SECTION_GRID_INNER_CLASS,
} from '@/lib/storefrontCarousel';
import { cleanDisplayText } from '@/lib/displayText';
import CategoryChipScroller from '@/components/CategoryChipScroller';
import { HomeExploreInterestsSkeleton } from '@/components/home/HomeSectionSkeletons';

const MAX_CATEGORIES = 10;
const MAX_PRODUCTS = 60;
const CATALOG_FETCH_LIMIT = 100;

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

function getProductCategoryCandidates(product) {
  const values = [];

  const pushValue = (value) => {
    const normalized = normalizeToken(value);
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
    product.categories.forEach((item) => pushMaybeObject(item));
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
  return normalizeImages(product.images).length > 0;
}

function sortByLatest(products) {
  return [...products].sort((left, right) => {
    const leftTime = new Date(left?.createdAt || 0).getTime();
    const rightTime = new Date(right?.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

export default function CategoryInterestSection() {
  const [apiCategories, setApiCategories] = useState([]);
  const [sectionEnabled, setSectionEnabled] = useState(true);
  const [manualRecommendedIds, setManualRecommendedIds] = useState([]);
  const [manualRecommendedProducts, setManualRecommendedProducts] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [columnsPerRow, setColumnsPerRow] = useState(6);

  useEffect(() => {
    const updateColumns = () => {
      setColumnsPerRow(getColumnsForWidth(window.innerWidth));
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const latestProducts = useMemo(
    () => sortByLatest(catalogProducts.filter(isRenderableProduct)).slice(0, MAX_PRODUCTS),
    [catalogProducts]
  );

  const fallbackManualProducts = useMemo(() => {
    if (!Array.isArray(manualRecommendedIds) || manualRecommendedIds.length === 0) return [];

    const productMap = new Map(
      catalogProducts.map((product) => [String(product?._id || product?.id || ''), product])
    );

    return manualRecommendedIds
      .map((id) => productMap.get(String(id || '').trim()))
      .filter(isRenderableProduct);
  }, [manualRecommendedIds, catalogProducts]);

  const categoryBuckets = useMemo(() => {
    const bucket = new Map();

    catalogProducts.forEach((product) => {
      const rawCategory =
        product?.category?.name ||
        product?.categoryName ||
        product?.category ||
        product?.subcategory ||
        '';

      const category = normalizeCategory(rawCategory);
      if (!category) return;

      bucket.set(category, (bucket.get(category) || 0) + 1);
    });

    return Array.from(bucket.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CATEGORIES)
      .map(([name]) => ({
        key: `bucket:${name}`,
        label: name,
        id: null,
        slug: null,
      }));
  }, [catalogProducts]);

  const [selectedCategoryKey, setSelectedCategoryKey] = useState('recommended');

  useEffect(() => {
    let isActive = true;

    const fetchCatalog = async () => {
      try {
        const response = await fetch(`/api/products?limit=${CATALOG_FETCH_LIMIT}&slim=true`);
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

    fetchCatalog();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories', { next: { revalidate: 300 } });
        if (!response.ok) return;

        const data = await response.json();
        if (!isActive) return;

        const normalized = Array.isArray(data?.categories)
          ? data.categories
              .filter((cat) => cat && !cat.parentId && normalizeCategory(cat.name))
              .map((cat) => ({
                key: `api:${String(cat._id || cat.slug || cat.name)}`,
                label: normalizeCategory(cat.name),
                id: normalizeToken(cat._id),
                slug: normalizeToken(cat.slug),
              }))
          : [];

        setApiCategories(normalized.slice(0, MAX_CATEGORIES));
      } catch {
        // Keep fallback categories from product buckets.
      }
    };

    fetchCategories();

    return () => {
      isActive = false;
    };
  }, []);

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
        // Keep section enabled with latest-products fallback on failure.
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

    const fetchManualProducts = async () => {
      if (!Array.isArray(manualRecommendedIds) || manualRecommendedIds.length === 0) {
        setManualRecommendedProducts([]);
        return;
      }

      try {
        const response = await fetch('/api/products/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: manualRecommendedIds.slice(0, MAX_PRODUCTS) }),
        });

        if (!response.ok) {
          if (isActive) setManualRecommendedProducts([]);
          return;
        }

        const data = await response.json();
        if (!isActive) return;

        const normalized = Array.isArray(data?.products)
          ? data.products.filter(isRenderableProduct)
          : [];

        setManualRecommendedProducts(normalized);
      } catch {
        if (isActive) setManualRecommendedProducts([]);
      }
    };

    fetchManualProducts();

    return () => {
      isActive = false;
    };
  }, [manualRecommendedIds]);

  const categoriesToRender = useMemo(() => {
    return [
      { key: 'recommended', label: 'Recommended', id: null, slug: null },
      ...(apiCategories.length ? apiCategories : categoryBuckets),
    ];
  }, [apiCategories, categoryBuckets]);

  const selectedCategoryOption = useMemo(() => {
    return categoriesToRender.find((category) => category.key === selectedCategoryKey) || categoriesToRender[0];
  }, [categoriesToRender, selectedCategoryKey]);

  useEffect(() => {
    const exists = categoriesToRender.some((category) => category.key === selectedCategoryKey);
    if (!exists) {
      setSelectedCategoryKey('recommended');
    }
  }, [categoriesToRender, selectedCategoryKey]);

  const displayedProducts = useMemo(() => {
    if (!selectedCategoryOption || selectedCategoryOption.key === 'recommended') {
      if (manualRecommendedProducts.length > 0) {
        return manualRecommendedProducts.slice(0, MAX_PRODUCTS);
      }
      if (fallbackManualProducts.length > 0) {
        return fallbackManualProducts.slice(0, MAX_PRODUCTS);
      }
      return latestProducts;
    }

    const selectedLabel = normalizeToken(selectedCategoryOption.label);
    const selectedId = normalizeToken(selectedCategoryOption.id);
    const selectedSlug = normalizeToken(selectedCategoryOption.slug);

    return catalogProducts
      .filter((product) => {
        const candidates = getProductCategoryCandidates(product);
        if (candidates.length === 0) return false;

        if (selectedId && candidates.includes(selectedId)) return true;
        if (selectedSlug && candidates.includes(selectedSlug)) return true;
        if (selectedLabel && candidates.includes(selectedLabel)) return true;

        return false;
      })
      .slice(0, MAX_PRODUCTS);
  }, [
    catalogProducts,
    selectedCategoryOption,
    manualRecommendedProducts,
    fallbackManualProducts,
    latestProducts,
  ]);

  if (!sectionEnabled) {
    return null;
  }

  if (catalogLoading && catalogProducts.length === 0) {
    return <HomeExploreInterestsSkeleton productCount={columnsPerRow} />;
  }

  const productSkeletonCount = columnsPerRow;

  return (
    <section className={HOME_SECTION_CLASS}>
      <div className={HOME_SECTION_GRID_INNER_CLASS}>
        <div className="mb-4 sm:mb-5">
          <h2 className={HOME_SECTION_BLOCK_HEADING_CLASS}>Explore your interests</h2>
        </div>

        <CategoryChipScroller
          items={categoriesToRender}
          activeKey={selectedCategoryOption?.key}
          onSelect={setSelectedCategoryKey}
          ariaLabel="Explore your interests categories"
        />

        {catalogLoading && displayedProducts.length === 0 ? (
          <div className={HOME_PRODUCT_GRID_CLASS}>
            {Array.from({ length: productSkeletonCount }).map((_, index) => (
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
            ))}
          </div>
        ) : displayedProducts.length > 0 ? (
          <div className={HOME_PRODUCT_GRID_CLASS}>
            {displayedProducts.map((product, index) => (
              <ProductCard
                key={product._id || product.id || product.slug}
                product={product}
                priorityImages={index < 6}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
              <PackageOpen size={28} className="text-slate-400" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-slate-600">No products found in this category.</p>
            <p className="mt-1 text-xs text-slate-400">Try selecting another interest above.</p>
          </div>
        )}
      </div>
    </section>
  );
}
