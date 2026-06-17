import { cleanDisplayText } from '@/lib/displayText';

export function getCategoryRecordId(category) {
  return String(category?._id || category?.id || '').trim();
}

export function getCategoryParentRecordId(category) {
  return String(category?.parentId || category?.parent || '').trim();
}

export function getCategoryDisplayName(category) {
  return cleanDisplayText(category?.name || category?.nameAr || '');
}

export function filterParentCategories(categories = []) {
  const list = Array.isArray(categories) ? categories : [];
  const ids = new Set(list.map(getCategoryRecordId).filter(Boolean));
  const parentIdsWithChildren = new Set();

  list.forEach((category) => {
    const parentId = getCategoryParentRecordId(category);
    if (parentId) parentIdsWithChildren.add(parentId);

    const categoryId = getCategoryRecordId(category);
    if (categoryId && Array.isArray(category.children) && category.children.length > 0) {
      parentIdsWithChildren.add(categoryId);
    }
  });

  return list.filter((category) => {
    const name = getCategoryDisplayName(category);
    if (!name) return false;

    const categoryId = getCategoryRecordId(category);
    const parentId = getCategoryParentRecordId(category);
    const isRoot = !parentId || !ids.has(parentId);

    return isRoot && categoryId && parentIdsWithChildren.has(categoryId);
  });
}

export function getDirectChildCategories(categories = [], parentCategory) {
  const parentId = getCategoryRecordId(parentCategory);
  if (!parentId) return [];

  const nestedChildren = Array.isArray(parentCategory?.children) ? parentCategory.children : [];
  const flatChildren = categories.filter(
    (item) => getCategoryParentRecordId(item) === parentId,
  );

  const merged = new Map();

  [...nestedChildren, ...flatChildren].forEach((item) => {
    const itemId = getCategoryRecordId(item) || String(item?.slug || item?.name || '').trim();
    if (!itemId || merged.has(itemId)) return;
    merged.set(itemId, item);
  });

  return Array.from(merged.values())
    .filter((item) => getCategoryDisplayName(item))
    .sort((left, right) => getCategoryDisplayName(left).localeCompare(getCategoryDisplayName(right)));
}
