import { notFound, redirect } from 'next/navigation';
import { getProductPageData } from '@/lib/productPageData';
import { productUsesProductsPath } from '@/lib/productUrl';

const EMPTY_PAGE_DATA = {
  product: null,
  reviews: [],
  relatedProducts: [],
  fbt: { enableFBT: false, products: [], bundlePrice: 0, bundleDiscount: 0 },
};

export async function loadProductPageData(slug, language = 'en') {
  try {
    return await getProductPageData(slug, language);
  } catch (error) {
    console.error('[product-page] failed to load data:', slug, error);
    return EMPTY_PAGE_DATA;
  }
}

/**
 * @param {'product' | 'products'} expectedPath - which URL prefix this route serves
 */
export async function resolveProductPage(slug, language, expectedPath) {
  const normalizedSlug = String(slug || '').trim();
  if (!normalizedSlug) {
    notFound();
  }

  const initialData = await loadProductPageData(normalizedSlug, language);

  if (!initialData?.product) {
    notFound();
  }

  const usesProductsPath = productUsesProductsPath(initialData.product);

  if (expectedPath === 'product' && usesProductsPath) {
    redirect(`/products/${normalizedSlug}`);
  }

  if (expectedPath === 'products' && !usesProductsPath) {
    redirect(`/product/${normalizedSlug}`);
  }

  return initialData;
}
