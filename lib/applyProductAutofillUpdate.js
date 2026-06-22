function slugifyValue(value = '') {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function mergeUniqueList(existing = [], incoming = []) {
  const base = Array.isArray(existing) ? existing : [];
  const next = Array.isArray(incoming) ? incoming : [];
  return Array.from(new Set([...base, ...next].map((item) => String(item || '').trim()).filter(Boolean)));
}

export function buildProductUpdateFromAutofill(autofill = {}, existingProduct = {}, options = {}) {
  const { includeArabic = true, updateSlug = false } = options;
  const update = {};

  const assignIfPresent = (field, value) => {
    if (value === undefined || value === null) return;
    const text = typeof value === 'string' ? value.trim() : value;
    if (typeof text === 'string' && !text) return;
    update[field] = value;
  };

  assignIfPresent('name', autofill.name);
  assignIfPresent('brand', autofill.brand);
  assignIfPresent('shortDescription', autofill.shortDescription);
  assignIfPresent('shortDescription2', autofill.shortDescription2);
  assignIfPresent('description', autofill.description);
  assignIfPresent('seoTitle', autofill.seoTitle);
  assignIfPresent('seoDescription', autofill.seoDescription);
  assignIfPresent('deliveredBy', autofill.deliveredBy);
  assignIfPresent('soldBy', autofill.soldBy);
  assignIfPresent('paymentInfo', autofill.paymentInfo);

  if (Array.isArray(autofill.specTableRows) && autofill.specTableRows.length > 0) {
    update.specTableEnabled = Boolean(autofill.specTableEnabled ?? true);
    update.specTableColumns = autofill.specTableColumns || ['Property', 'Value'];
    update.specTableRows = autofill.specTableRows;
  }

  if (Array.isArray(autofill.tags) && autofill.tags.length > 0) {
    update.tags = mergeUniqueList(existingProduct.tags, autofill.tags);
  }
  if (Array.isArray(autofill.seoKeywords) && autofill.seoKeywords.length > 0) {
    update.seoKeywords = mergeUniqueList(existingProduct.seoKeywords, autofill.seoKeywords);
  }

  if (Array.isArray(autofill.suggestedCategoryIds) && autofill.suggestedCategoryIds.length > 0) {
    update.categories = autofill.suggestedCategoryIds;
    update.category = autofill.suggestedCategoryIds[0];
  }

  if (updateSlug && autofill.name) {
    update.slug = slugifyValue(autofill.name);
  }

  if (includeArabic) {
    assignIfPresent('nameAr', autofill.nameAr);
    assignIfPresent('brandAr', autofill.brandAr);
    assignIfPresent('shortDescriptionAr', autofill.shortDescriptionAr);
    assignIfPresent('shortDescription2Ar', autofill.shortDescription2Ar);
    assignIfPresent('descriptionAr', autofill.descriptionAr);
  }

  if (autofill.attributes && typeof autofill.attributes === 'object') {
    update.attributes = {
      ...(existingProduct.attributes || {}),
      ...autofill.attributes,
    };
  }

  return update;
}

import { getProductThumbnailUrl } from '@/lib/productMedia';

export function getFirstProductImageUrl(product = {}) {
  const thumbnail = getProductThumbnailUrl(product, { fallback: '', allowVideo: false });
  const url = String(thumbnail || '').trim();
  if (!url || url === '/placeholder.png') return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('/')) return url;
  return '';
}
