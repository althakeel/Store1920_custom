import { cleanDisplayText } from '@/lib/displayText';

export function normalizeCategoryRef(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    return String(value._id || value.id || value.slug || '').trim();
  }
  return String(value).trim();
}

export function buildCategoryLookup(categories = []) {
  const map = {};

  const visit = (category) => {
    if (!category) return;

    const name = cleanDisplayText(category.name || category.nameAr || '');
    const id = String(category._id || category.id || '').trim();
    const legacyId = String(category.legacySourceId || '').trim();
    const slug = String(category.slug || '').trim().toLowerCase();

    if (id && name) map[id] = name;
    if (legacyId && name) map[legacyId] = name;
    if (slug && name) map[slug] = name;
    if (name) map[name.toLowerCase()] = name;

    if (Array.isArray(category.children)) {
      category.children.forEach(visit);
    }
  };

  categories.forEach(visit);
  return map;
}

export function resolveCategoryName(categoryMap, value = '') {
  const key = normalizeCategoryRef(value);
  if (!key) return '';

  return (
    categoryMap[key]
    || categoryMap[key.toLowerCase()]
    || (typeof value === 'object' ? cleanDisplayText(value.name || value.nameAr || '') : '')
    || ''
  );
}

export function getProductCategoryRefs(product = {}) {
  if (Array.isArray(product.categories) && product.categories.length) {
    return product.categories.map(normalizeCategoryRef).filter(Boolean);
  }

  const single = normalizeCategoryRef(product.category);
  return single ? [single] : [];
}

function looksLikeObjectId(value = '') {
  return /^[a-f0-9]{24}$/i.test(String(value || '').trim());
}

export function getProductCategoryLabels(product = {}, categoryMap = {}) {
  return getProductCategoryRefs(product)
    .map((ref) => {
      const resolved = resolveCategoryName(categoryMap, ref);
      if (resolved) return resolved;
      if (looksLikeObjectId(ref)) return '';
      return ref;
    })
    .filter(Boolean);
}

export async function buildCategoryLookupFromDb(Category) {
  const categories = await Category.find({})
    .select('_id name nameAr slug legacySourceId parentId')
    .lean();

  return buildCategoryLookup(categories);
}
