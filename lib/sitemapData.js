import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Store from '@/models/Store';
import { getAllActiveCategories } from '@/lib/categoryPageData';
import { buildCategoryUrl } from '@/lib/categorySlug';
import { getProductPath } from '@/lib/productUrl';
import { STOREFRONT_PUBLISHED_FILTER } from '@/lib/productVisibility';

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://store1920.com').replace(/\/$/, '');
export const PRODUCTS_PER_SITEMAP = 10000;

/** id 0 = static pages, categories, and store profiles. id 1+ = product chunks. */
export const STATIC_SITEMAP_ID = 0;

export const PUBLIC_STATIC_ROUTES = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/shop', priority: 0.9, changeFrequency: 'daily' },
  { path: '/products', priority: 0.9, changeFrequency: 'daily' },
  { path: '/categories', priority: 0.85, changeFrequency: 'weekly' },
  { path: '/sitemap', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/fast-delivery', priority: 0.8, changeFrequency: 'daily' },
  { path: '/top-selling', priority: 0.8, changeFrequency: 'daily' },
  { path: '/new', priority: 0.8, changeFrequency: 'daily' },
  { path: '/new-arrivals', priority: 0.8, changeFrequency: 'daily' },
  { path: '/trending-now', priority: 0.8, changeFrequency: 'daily' },
  { path: '/best-sellers', priority: 0.8, changeFrequency: 'daily' },
  { path: '/5-star-rated', priority: 0.75, changeFrequency: 'weekly' },
  { path: '/clearance-sale', priority: 0.8, changeFrequency: 'daily' },
  { path: '/offers', priority: 0.8, changeFrequency: 'daily' },
  { path: '/under-149', priority: 0.75, changeFrequency: 'weekly' },
  { path: '/under-499', priority: 0.75, changeFrequency: 'weekly' },
  { path: '/recommended', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/recently-viewed', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/about-us', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/blogs', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/business-information', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact-us', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.55, changeFrequency: 'monthly' },
  { path: '/help', priority: 0.55, changeFrequency: 'monthly' },
  { path: '/support', priority: 0.55, changeFrequency: 'monthly' },
  { path: '/careers', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/create-store', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/pricing', priority: 0.55, changeFrequency: 'monthly' },
  { path: '/payment-and-pricing', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/terms-and-conditions', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/terms-of-sale', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.35, changeFrequency: 'yearly' },
  { path: '/privacy-policy', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.35, changeFrequency: 'yearly' },
  { path: '/shipping-policy', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/shipping', priority: 0.35, changeFrequency: 'yearly' },
  { path: '/return-policy', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/refund-policy', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/cancellation-and-refunds', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/cancellation-policy', priority: 0.35, changeFrequency: 'yearly' },
  { path: '/cookie-policy', priority: 0.35, changeFrequency: 'yearly' },
  { path: '/warranty-policy', priority: 0.35, changeFrequency: 'yearly' },
];

export function buildAbsoluteUrl(path = '/') {
  const normalized = String(path || '/').startsWith('/') ? String(path) : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

function buildCategoryChainUrl(allCategories, category) {
  const chain = [];
  let current = category;

  while (current) {
    chain.unshift(current);
    const parentId = String(current.parentId || '');
    current = parentId
      ? allCategories.find((item) => String(item._id) === parentId)
      : null;
  }

  return buildAbsoluteUrl(buildCategoryUrl(chain));
}

export function buildStaticSitemapEntries() {
  return PUBLIC_STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: buildAbsoluteUrl(path),
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}

export async function buildCategorySitemapEntries() {
  const categories = await getAllActiveCategories();

  return categories.map((category) => ({
    url: buildCategoryChainUrl(categories, category),
    lastModified: category.updatedAt ? new Date(category.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: category.level === 1 ? 0.8 : category.level === 2 ? 0.7 : 0.6,
  }));
}

export async function buildStoreSitemapEntries() {
  await connectDB();

  const stores = await Store.find({
    status: 'approved',
    isActive: true,
    username: { $exists: true, $ne: '' },
  })
    .select('username updatedAt')
    .lean();

  return stores.map((store) => ({
    url: buildAbsoluteUrl(`/shop/${String(store.username).trim()}`),
    lastModified: store.updatedAt ? new Date(store.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));
}

export async function countPublishedProducts() {
  await connectDB();

  return Product.countDocuments({
    ...STOREFRONT_PUBLISHED_FILTER,
    slug: { $exists: true, $nin: ['', null] },
  });
}

export async function buildProductSitemapEntries(productSitemapIndex = 0) {
  await connectDB();

  const products = await Product.find({
    ...STOREFRONT_PUBLISHED_FILTER,
    slug: { $exists: true, $nin: ['', null] },
  })
    .select('slug useProductsPath updatedAt')
    .sort({ updatedAt: -1 })
    .skip(productSitemapIndex * PRODUCTS_PER_SITEMAP)
    .limit(PRODUCTS_PER_SITEMAP)
    .lean();

  return products.map((product) => ({
    url: buildAbsoluteUrl(getProductPath(product)),
    lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));
}

export async function buildStaticBundleSitemapEntries() {
  const [categoryEntries, storeEntries] = await Promise.all([
    buildCategorySitemapEntries(),
    buildStoreSitemapEntries(),
  ]);

  return [
    ...buildStaticSitemapEntries(),
    ...categoryEntries,
    ...storeEntries,
  ];
}

export async function getSitemapIds() {
  const productCount = await countPublishedProducts();
  const productSitemapCount = Math.ceil(productCount / PRODUCTS_PER_SITEMAP);
  const ids = [{ id: STATIC_SITEMAP_ID }];

  for (let index = 0; index < productSitemapCount; index += 1) {
    ids.push({ id: index + 1 });
  }

  return ids;
}
