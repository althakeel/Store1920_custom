import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import Product from '@/models/Product';
import { STOREFRONT_PUBLISHED_FILTER } from '@/lib/productVisibility';
import { parseCategoryPathSegments } from '@/lib/categorySlug';
import { deleteCacheKey } from '@/lib/cache';

const CATEGORY_CACHE_KEY = 'public:categories:tree:v5';

export async function getAllActiveCategories() {
  await connectDB();
  return Category.find({ isActive: { $ne: false } })
    .select('name nameAr slug image parentId description descriptionAr level metaTitle metaDescription sortOrder url')
    .sort({ level: 1, sortOrder: 1, name: 1 })
    .lean();
}

export async function resolveCategoryByPathSegments(pathSegments = []) {
  const segments = parseCategoryPathSegments(pathSegments.join('/'));
  if (!segments.length) return null;

  await connectDB();
  const all = await getAllActiveCategories();
  const bySlug = new Map(all.map((item) => [String(item.slug).toLowerCase(), item]));

  const chain = [];
  let parentId = null;

  for (const segment of segments) {
    const match = all.find((item) => {
      const slugOk = String(item.slug).toLowerCase() === segment;
      const parentOk = parentId ? String(item.parentId || '') === String(parentId) : !item.parentId;
      return slugOk && parentOk;
    }) || bySlug.get(segment);

    if (!match) return null;
    chain.push(match);
    parentId = match._id;
  }

  if (chain.length !== segments.length) return null;

  const category = chain[chain.length - 1];
  const children = all
    .filter((item) => String(item.parentId || '') === String(category._id))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name).localeCompare(String(b.name)));

  return { category, chain, children, all };
}

export async function getCategoryProducts(categoryId, { limit = 48, page = 1 } = {}) {
  await connectDB();
  const category = await Category.findById(categoryId).select('_id slug name').lean();
  if (!category) return { products: [], total: 0 };

  const id = String(category._id);
  const slug = String(category.slug || '');
  const name = String(category.name || '');

  const match = {
    $and: [
      STOREFRONT_PUBLISHED_FILTER,
      {
        $or: [
          { category: id },
          { categories: id },
          { category: slug },
          { categories: slug },
          { category: name },
          { categories: name },
        ],
      },
    ],
  };

  const skip = Math.max(0, (page - 1) * limit);
  const [products, total] = await Promise.all([
    Product.find(match)
      .select('name slug price AED images brand inStock fastDelivery')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(match),
  ]);

  return { products, total, page, limit };
}

export function invalidateCategoryPageCaches() {
  deleteCacheKey(CATEGORY_CACHE_KEY);
}
