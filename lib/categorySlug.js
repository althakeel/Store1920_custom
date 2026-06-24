/** @param {string} value */
export function slugifyCategory(value = '') {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** @param {{ slug?: string }[]} ancestorsIncludingSelf */
export function buildCategoryPathSegments(ancestorsIncludingSelf = []) {
  return ancestorsIncludingSelf
    .map((item) => String(item?.slug || '').trim())
    .filter(Boolean);
}

/** @param {{ slug?: string }[]} ancestorsIncludingSelf */
export function buildCategoryUrl(ancestorsIncludingSelf = []) {
  const segments = buildCategoryPathSegments(ancestorsIncludingSelf);
  return segments.length ? `/category/${segments.join('/')}` : '/shop';
}

/** @param {string} path */
export function parseCategoryPathSegments(path = '') {
  return String(path || '')
    .replace(/^\/+/, '')
    .replace(/^category\/?/i, '')
    .split('/')
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
}

/** Normalize legacy category labels for lookup (HTML entities, amp splits). */
export function normalizeCategoryLabel(value = '') {
  return String(value || '')
    .replace(/&amp;?/gi, ' and ')
    .replace(/&#0*39;/gi, "'")
    .replace(/â€™/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
