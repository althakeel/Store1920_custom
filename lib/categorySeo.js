import { buildCategoryUrl } from './categorySlug.js';

export function buildCategoryMetaTitle(category, siteName = 'Store1920') {
  const custom = String(category?.metaTitle || '').trim();
  if (custom) return custom;
  const name = String(category?.name || 'Category').trim();
  return `${name} | ${siteName}`;
}

export function buildCategoryMetaDescription(category) {
  const custom = String(category?.metaDescription || '').trim();
  if (custom) return custom;
  const name = String(category?.name || 'products').trim();
  return `Shop ${name} online at Store1920. Discover great deals, fast delivery, and quality products across the UAE.`;
}

export function buildCategoryBreadcrumbs(categoryChain = []) {
  const items = [{ name: 'Home', href: '/' }];
  let pathSegments = [];

  for (const category of categoryChain) {
    pathSegments = [...pathSegments, String(category.slug || '').trim()].filter(Boolean);
    items.push({
      name: String(category.name || '').trim(),
      href: `/category/${pathSegments.join('/')}`,
    });
  }

  return items;
}

export function buildBreadcrumbListJsonLd(categoryChain = [], siteUrl = '') {
  const base = String(siteUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://store1920.com').replace(/\/$/, '');
  const breadcrumbs = buildCategoryBreadcrumbs(categoryChain);

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${base}${item.href}`,
    })),
  };
}

export function buildCategoryCanonicalUrl(categoryChain = [], siteUrl = '') {
  const base = String(siteUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://store1920.com').replace(/\/$/, '');
  return `${base}${buildCategoryUrl(categoryChain)}`;
}
