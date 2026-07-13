export function isCategoryObjectId(value) {
  const normalized = String(value || '').trim();
  return /^[a-f0-9]{24}$/i.test(normalized);
}

export function dedupeCategoryIds(ids = []) {
  return Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)));
}

/** Keep only canonical category ObjectIds (drops legacy slug/name strings). */
export function sanitizeCategoryIdsForSave(ids = []) {
  return dedupeCategoryIds(ids).filter(isCategoryObjectId);
}

export function buildCategoryIdMatch(categoryId) {
  const id = String(categoryId || '').trim();
  if (!isCategoryObjectId(id)) return null;

  return {
    $or: [
      { category: id },
      { categories: id },
    ],
  };
}
