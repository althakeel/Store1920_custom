import { getAllActiveCategories } from '@/lib/categoryPageData';
import { buildCategoryUrl } from '@/lib/categorySlug';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://store1920.com').replace(/\/$/, '');

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

  return `${SITE_URL}${buildCategoryUrl(chain)}`;
}

export default async function sitemap() {
  const categories = await getAllActiveCategories();

  const categoryEntries = categories.map((category) => ({
    url: buildCategoryChainUrl(categories, category),
    lastModified: category.updatedAt ? new Date(category.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: category.level === 1 ? 0.8 : category.level === 2 ? 0.7 : 0.6,
  }));

  const staticEntries = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/shop`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/categories`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/products`, changeFrequency: 'daily', priority: 0.8 },
  ];

  return [...staticEntries, ...categoryEntries];
}
