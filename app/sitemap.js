import {
  STATIC_SITEMAP_ID,
  buildProductSitemapEntries,
  buildStaticBundleSitemapEntries,
  getSitemapIds,
} from '@/lib/sitemapData';

export const revalidate = 3600;

export async function generateSitemaps() {
  return getSitemapIds();
}

export default async function sitemap({ id } = {}) {
  const sitemapId = Number.parseInt(String(id ?? STATIC_SITEMAP_ID), 10);

  if (!Number.isFinite(sitemapId) || sitemapId === STATIC_SITEMAP_ID) {
    return buildStaticBundleSitemapEntries();
  }

  return buildProductSitemapEntries(Math.max(0, sitemapId - 1));
}
