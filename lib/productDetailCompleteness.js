const HTML_TAG_RE = /<[^>]*>/g;

export function stripRichText(value = '') {
  return String(value || '')
    .replace(HTML_TAG_RE, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasMeaningfulText(value = '', minLength = 3) {
  return stripRichText(value).length >= minLength;
}

export const PRODUCT_DETAIL_CHECKS = [
  { key: 'images', label: 'Product images' },
  { key: 'name', label: 'English name' },
  { key: 'categories', label: 'Categories' },
  { key: 'sku', label: 'SKU' },
  { key: 'shortDescription', label: 'Short description (EN)' },
  { key: 'description', label: 'Full description (EN)' },
  { key: 'shortDescriptionAr', label: 'Short description (AR)' },
  { key: 'descriptionAr', label: 'Full description (AR)' },
  { key: 'tags', label: 'Tags' },
  { key: 'brandOrSeo', label: 'Brand or SEO title' },
];

function hasCategories(product = {}) {
  const refs = [
    product.category,
    ...(Array.isArray(product.categories) ? product.categories : []),
  ].filter(Boolean);
  return refs.length > 0;
}

function hasImages(product = {}) {
  const images = [
    ...(Array.isArray(product.images) ? product.images : []),
    ...(Array.isArray(product.externalImages) ? product.externalImages : []),
  ].filter(Boolean);
  return images.length > 0;
}

function evaluateCheck(key, product = {}) {
  switch (key) {
    case 'images':
      return hasImages(product);
    case 'name':
      return hasMeaningfulText(product.name, 2);
    case 'categories':
      return hasCategories(product);
    case 'sku':
      return hasMeaningfulText(product.sku, 1);
    case 'shortDescription':
      return hasMeaningfulText(product.shortDescription, 3);
    case 'description':
      return hasMeaningfulText(product.description, 20);
    case 'shortDescriptionAr':
      return hasMeaningfulText(product.shortDescriptionAr, 3);
    case 'descriptionAr':
      return hasMeaningfulText(product.descriptionAr, 20);
    case 'tags':
      return Array.isArray(product.tags) && product.tags.some((tag) => hasMeaningfulText(tag, 1));
    case 'brandOrSeo':
      return hasMeaningfulText(product.brand, 1) || hasMeaningfulText(product.seoTitle, 3);
    default:
      return false;
  }
}

export function getProductDetailCompleteness(product = {}) {
  const checks = PRODUCT_DETAIL_CHECKS.map((item) => ({
    ...item,
    filled: evaluateCheck(item.key, product),
  }));

  const filledCount = checks.filter((item) => item.filled).length;
  const totalCount = checks.length;
  const percent = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  let tone = 'critical';
  if (percent >= 100) tone = 'complete';
  else if (percent >= 70) tone = 'good';
  else if (percent >= 40) tone = 'partial';

  const missingLabels = checks.filter((item) => !item.filled).map((item) => item.label);

  return {
    checks,
    filledCount,
    totalCount,
    percent,
    tone,
    missingLabels,
  };
}
