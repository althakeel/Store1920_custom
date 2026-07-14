import redirects from '@/data/productRedirects.json';

const REDIRECT_MAP = new Map(
  Object.entries(redirects).map(([key, target]) => [key.toLowerCase(), target]),
);

/**
 * Resolve a permanent redirect target for a product slug
 * (legacy / renamed products).
 * @param {string} slug
 * @returns {string|null} absolute path like /products/new-slug
 */
export function resolveProductSlugRedirect(slug = '') {
  const normalized = String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/^(product|products)\//, '');
  if (!normalized) return null;
  return REDIRECT_MAP.get(normalized) || null;
}

/** Entries for next.config.js redirects() — 301 for both /product and /products prefixes. */
export function getProductRedirectEntries() {
  return Object.entries(redirects).flatMap(([fromSlug, destination]) => {
    const sourceSlug = String(fromSlug || '').trim().replace(/^\/+/, '');
    const dest = String(destination || '').trim();
    if (!sourceSlug || !dest) return [];
    return [
      {
        source: `/product/${sourceSlug}`,
        destination: dest,
        permanent: true,
      },
      {
        source: `/products/${sourceSlug}`,
        destination: dest,
        permanent: true,
      },
    ];
  });
}
