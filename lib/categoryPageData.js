import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import Product from '@/models/Product';
import Rating from '@/models/Rating';
import { STOREFRONT_PUBLISHED_FILTER } from '@/lib/productVisibility';
import { parseCategoryPathSegments } from '@/lib/categorySlug';
import { deleteCacheKey } from '@/lib/cache';
import {
  buildCategoryIdAliases,
  findCategoryByPathSegments,
  normalizeCategoryParentIds,
} from '@/lib/categoryTreeUtils';
import {
  countProductsDedupedBySku,
  fetchProductsDedupedBySku,
} from '@/lib/productSkuDedupe';
import { buildCategoryIdMatch } from '@/lib/productCategoryRefs';

const CATEGORY_CACHE_KEY = 'public:categories:tree:v5';
const CATEGORY_PRODUCTS_FETCH_ALL_CAP = 500;

function serializeClientPayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

async function attachProductRatings(products = []) {
  if (!products.length) return products;

  const productIds = products.map((product) => String(product._id));
  const ratingsMap = {};

  try {
    const allRatings = await Rating.find({
      productId: { $in: productIds },
      approved: true,
    })
      .select('productId rating')
      .lean();

    allRatings.forEach((review) => {
      const key = String(review.productId);
      if (!ratingsMap[key]) ratingsMap[key] = [];
      ratingsMap[key].push(review.rating);
    });
  } catch (error) {
    console.error('Category ratings fetch error:', error);
  }

  return products.map((product) => {
    const reviews = ratingsMap[String(product._id)] || [];
    const ratingCount = reviews.length;
    const averageRating = ratingCount > 0
      ? reviews.reduce((sum, rating) => sum + rating, 0) / ratingCount
      : 0;

    return {
      ...product,
      ratingCount,
      averageRating,
    };
  });
}

export async function getAllActiveCategories() {
  await connectDB();
  const raw = await Category.find({ isActive: { $ne: false } })
    .select('name nameAr slug image parentId description descriptionAr level metaTitle metaDescription sortOrder url legacySourceId')
    .sort({ level: 1, sortOrder: 1, name: 1 })
    .lean();

  const aliases = buildCategoryIdAliases(raw);
  return normalizeCategoryParentIds(raw, aliases);
}

export async function resolveCategoryByPathSegments(pathSegments = []) {
  const segments = parseCategoryPathSegments(pathSegments.join('/'));
  if (!segments.length) return null;

  await connectDB();
  const all = await getAllActiveCategories();
  const resolved = findCategoryByPathSegments(all, segments);
  if (!resolved) return null;

  return { ...resolved, all };
}

export async function getCategoryProducts(categoryId, { limit = 48, page = 1, fetchAll = false } = {}) {
  await connectDB();
  const category = await Category.findById(categoryId).select('_id slug name').lean();
  if (!category) return { products: [], total: 0 };

  const categoryMatch = buildCategoryIdMatch(category._id);
  if (!categoryMatch) return { products: [], total: 0 };

  const match = {
    $and: [
      STOREFRONT_PUBLISHED_FILTER,
      categoryMatch,
    ],
  };

  const effectiveLimit = fetchAll ? CATEGORY_PRODUCTS_FETCH_ALL_CAP : limit;
  const skip = fetchAll ? 0 : Math.max(0, (page - 1) * limit);
  const [rawProducts, total] = await Promise.all([
    fetchProductsDedupedBySku(Product, match, {
      sort: { createdAt: -1 },
      skip,
      limit: effectiveLimit,
    }),
    countProductsDedupedBySku(Product, match),
  ]);

  const productsWithRatings = await attachProductRatings(rawProducts);

  return {
    products: serializeClientPayload(productsWithRatings),
    total,
    page: fetchAll ? 1 : page,
    limit: effectiveLimit,
    fetchAll,
  };
}

export function invalidateCategoryPageCaches() {
  deleteCacheKey(CATEGORY_CACHE_KEY);
}
