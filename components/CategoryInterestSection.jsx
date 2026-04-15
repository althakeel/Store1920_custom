'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import ProductCard from '@/components/ProductCard';

const MAX_CATEGORIES = 10;
const MAX_PRODUCTS = 20;
const INITIAL_VISIBLE_PRODUCTS = 30;

function normalizeCategory(value) {
  return String(value || '').trim();
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

export default function CategoryInterestSection() {
  const products = useSelector((state) => state.product.list || []);
  const [apiCategories, setApiCategories] = useState([]);
  const [sectionEnabled, setSectionEnabled] = useState(true);
  const [manualRecommendedIds, setManualRecommendedIds] = useState([]);
  const [manualRecommendedProducts, setManualRecommendedProducts] = useState([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_PRODUCTS);

  const fallbackManualProducts = useMemo(() => {
    if (!Array.isArray(manualRecommendedIds) || manualRecommendedIds.length === 0) return [];

    const productMap = new Map(
      products.map((product) => [String(product?._id || product?.id || ''), product])
    );

    return manualRecommendedIds
      .map((id) => productMap.get(String(id || '').trim()))
      .filter(Boolean);
  }, [manualRecommendedIds, products]);

  const categoryBuckets = useMemo(() => {
    const bucket = new Map();

    products.forEach((product) => {
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
  }, [products]);

  const [selectedCategoryKey, setSelectedCategoryKey] = useState('recommended');

  useEffect(() => {
    let isActive = true;

    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/store/categories', { cache: 'no-store' });
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
        // Always use the public endpoint — it reads the same Store document the save writes to.
        const response = await fetch('/api/store/explore-interests/public', { cache: 'no-store' }).catch(() => null);
        if (!response?.ok || !isActive) return;

        const data = await response.json();
        if (!isActive) return;

        const ids = Array.isArray(data?.productIds)
          ? data.productIds.map((id) => String(id || '').trim()).filter(Boolean)
          : [];
        console.log('[ExploreInterests] API:', data?._storeId, 'productIds:', ids.length, ids.slice(0, 3));
        setSectionEnabled(typeof data?.enabled === 'boolean' ? data.enabled : true);
        setManualRecommendedIds(ids);
      } catch {
        // Keep section enabled with empty recommended on failure.
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
          body: JSON.stringify({ productIds: manualRecommendedIds }),
        });

        if (!response.ok) {
          if (isActive) setManualRecommendedProducts([]);
          return;
        }

        const data = await response.json();
        if (!isActive) return;

        const normalized = Array.isArray(data?.products) 
          ? data.products.filter(p => {
              if (!p || !p.name || !p.slug) return false;
              if (p.quantity !== undefined && typeof p.quantity === 'number' && !p.images) return false;
              return true;
            })
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
    if (!Array.isArray(products) || products.length === 0) {
      if (!selectedCategoryOption || selectedCategoryOption.key === 'recommended') {
        return manualRecommendedProducts.slice(0, MAX_PRODUCTS);
      }
      return [];
    }

    if (!selectedCategoryOption || selectedCategoryOption.key === 'recommended') {
      if (manualRecommendedProducts.length > 0) return manualRecommendedProducts;
      return fallbackManualProducts;
    }

    const selectedLabel = normalizeToken(selectedCategoryOption.label);
    const selectedId = normalizeToken(selectedCategoryOption.id);
    const selectedSlug = normalizeToken(selectedCategoryOption.slug);

    return products
      .filter((product) => {
        const candidates = getProductCategoryCandidates(product);
        if (candidates.length === 0) return false;

        if (selectedId && candidates.includes(selectedId)) return true;
        if (selectedSlug && candidates.includes(selectedSlug)) return true;
        if (selectedLabel && candidates.includes(selectedLabel)) return true;

        return false;
      })
      .slice(0, MAX_PRODUCTS);
  }, [products, selectedCategoryOption, manualRecommendedProducts, fallbackManualProducts]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_PRODUCTS);
  }, [selectedCategoryKey]);

  useEffect(() => {
    setVisibleCount((prev) => {
      if (displayedProducts.length === 0) return INITIAL_VISIBLE_PRODUCTS;
      return Math.min(Math.max(prev, INITIAL_VISIBLE_PRODUCTS), displayedProducts.length);
    });
  }, [displayedProducts]);

  const paginatedProducts = useMemo(() => {
    return displayedProducts.slice(0, visibleCount);
  }, [displayedProducts, visibleCount]);

  const hasMoreProducts = visibleCount < displayedProducts.length;

  if (!sectionEnabled) {
    return null;
  }

  // Final safety check before rendering: ensure all products are valid
  const safePaginatedProducts = paginatedProducts.filter(product => {
    if (!product || typeof product !== 'object') return false;
    
    if (!product.name || !product.slug) {
      console.error('[CategoryInterestSection] Rejected - missing name/slug:', { name: product.name, slug: product.slug, keys: Object.keys(product) });
      return false;
    }
    
    if (!Array.isArray(product.images) || product.images.length === 0) {
      console.error('[CategoryInterestSection] Rejected - invalid images:', { images: product.images });
      return false;
    }
    
    // Reject if it has cart-specific combination
    if (product.hasOwnProperty('quantity') && product.hasOwnProperty('price') && product.hasOwnProperty('variantOptions')) {
      console.error('[CategoryInterestSection] Rejected - cart item with all three keys:', product);
      return false;
    }

    if (typeof product.quantity === 'number') {
      console.error('[CategoryInterestSection] Rejected - quantity is number:', product);
      return false;
    }

    return true;
  });

  console.log('[CategoryInterestSection] Safe products:', safePaginatedProducts.length, 'from', paginatedProducts.length);

  return (
    <section className="w-full bg-white py-8 mb-6">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="mb-4">
          <h2 className="text-3xl font-bold text-gray-900">Explore your interests</h2>
        </div>

        <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
          {categoriesToRender.map((category) => {
            const isActive = category.key === selectedCategoryOption?.key;

            return (
              <button
                key={category.key}
                type="button"
                onClick={() => setSelectedCategoryKey(category.key)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'border-gray-900 bg-gray-100 text-gray-900'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        {displayedProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {safePaginatedProducts.map((product) => (
              <ProductCard key={product._id || product.id} product={product} />
            ))}
            </div>

            {hasMoreProducts && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => Math.min(prev + 6, displayedProducts.length))}
                  className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            No products found in this category.
          </div>
        )}
      </div>
    </section>
  );
}
