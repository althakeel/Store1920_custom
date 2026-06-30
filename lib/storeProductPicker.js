import { escapeRegex, normalizeSearchKeyword, buildFlexibleSkuRegex } from '@/lib/productSearch';

const PICKER_FIELDS = '_id name slug sku price AED mrp inStock published stockQuantity fastDelivery freeShippingEligible createdAt images externalImages category categories tags hasVariants imageAspectRatio';
const MANAGE_LIST_FIELDS = PICKER_FIELDS;

const PICKER_SEARCH_MIN_LENGTH = 2;

function buildPickerTermMatchers(term = '') {
  const normalized = String(term || '').trim();
  if (!normalized) return [];

  const termRegex = new RegExp(escapeRegex(normalized), 'i');
  const exactRegex = new RegExp(`^${escapeRegex(normalized)}$`, 'i');
  const skuFlexible = buildFlexibleSkuRegex(normalized);

  const matchers = [
    { name: termRegex },
    { sku: termRegex },
    { slug: termRegex },
    { sku: exactRegex },
    { slug: exactRegex },
    { 'variants.sku': termRegex },
    { 'variants.name': termRegex },
  ];

  if (skuFlexible) {
    matchers.push(
      { sku: skuFlexible },
      { 'variants.sku': skuFlexible },
    );
  }

  return matchers;
}

export function buildPickerSearchClause(search = '') {
  const normalized = normalizeSearchKeyword(search);
  if (!normalized || normalized.length < PICKER_SEARCH_MIN_LENGTH) return null;

  const words = normalized.split(' ').filter(Boolean);
  if (words.length > 1) {
    return { $and: words.map((word) => ({ $or: buildPickerTermMatchers(word) })) };
  }

  return { $or: buildPickerTermMatchers(normalized) };
}

export function buildPickerFilter(storeId, search = '', category = '') {
  const filter = { storeId };
  const query = String(search || '').trim();
  const categoryId = String(category || '').trim();

  if (categoryId) {
    filter.$or = [
      { category: categoryId },
      { categories: categoryId },
    ];
  }

  const searchClause = buildPickerSearchClause(query);
  if (searchClause) {
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, searchClause];
      delete filter.$or;
    } else {
      Object.assign(filter, searchClause);
    }
  }

  return filter;
}

export function buildPickerSort(sort = 'newest') {
  const sortMap = {
    name: { name: 1 },
    price: { price: 1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    relevance: { _pickerScore: -1, createdAt: -1 },
  };
  return sortMap[sort] || sortMap.newest;
}

function buildPickerSearchScoreStage(search = '') {
  const normalized = normalizeSearchKeyword(search);
  if (!normalized) return null;

  const escaped = escapeRegex(normalized);
  const lower = normalized.toLowerCase();

  return {
    $addFields: {
      _pickerScore: {
        $add: [
          { $cond: [{ $eq: [{ $toLower: { $ifNull: ['$sku', ''] } }, lower] }, 1000, 0] },
          { $cond: [{ $eq: [{ $toLower: { $ifNull: ['$slug', ''] } }, lower] }, 900, 0] },
          { $cond: [{ $regexMatch: { input: { $ifNull: ['$name', ''] }, regex: `^${escaped}`, options: 'i' } }, 500, 0] },
          { $cond: [{ $regexMatch: { input: { $ifNull: ['$sku', ''] }, regex: `^${escaped}`, options: 'i' } }, 400, 0] },
          { $cond: [{ $regexMatch: { input: { $ifNull: ['$name', ''] }, regex: escaped, options: 'i' } }, 200, 0] },
          { $cond: [{ $regexMatch: { input: { $ifNull: ['$sku', ''] }, regex: escaped, options: 'i' } }, 150, 0] },
          { $cond: [{ $regexMatch: { input: { $ifNull: ['$slug', ''] }, regex: escaped, options: 'i' } }, 100, 0] },
        ],
      },
    },
  };
}

function trimProductImages(product) {
  if (!product || typeof product !== 'object') return product;

  const images = Array.isArray(product.images) ? product.images.slice(0, 1) : product.images;
  const externalImages = Array.isArray(product.externalImages)
    ? product.externalImages.slice(0, 1)
    : product.externalImages;

  return {
    ...product,
    images,
    externalImages,
  };
}

export async function fetchPickerPage(Product, {
  storeId,
  page = 1,
  limit = 24,
  search = '',
  sort = 'newest',
  category = '',
  mode = 'picker',
} = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(48, Math.max(1, Number(limit) || 24));
  const skip = (safePage - 1) * safeLimit;
  const filter = buildPickerFilter(storeId, search, category);
  const trimmedSearch = normalizeSearchKeyword(search);
  const useRelevanceSort = sort === 'relevance' && trimmedSearch.length >= PICKER_SEARCH_MIN_LENGTH;
  const sortOption = buildPickerSort(useRelevanceSort ? 'relevance' : sort);
  const isManageMode = mode === 'manage';
  const isMediaMode = mode === 'media';

  const projection = isManageMode
    ? {
        _id: 1,
        name: 1,
        slug: 1,
        sku: 1,
        price: 1,
        AED: 1,
        mrp: 1,
        inStock: 1,
        published: 1,
        stockQuantity: 1,
        fastDelivery: 1,
        freeShippingEligible: 1,
        enableFBT: 1,
        fbtProductIds: 1,
        createdAt: 1,
        category: 1,
        categories: 1,
        tags: 1,
        hasVariants: 1,
        imageAspectRatio: 1,
        images: { $slice: [{ $ifNull: ['$images', []] }, 2] },
        externalImages: { $slice: [{ $ifNull: ['$externalImages', []] }, 1] },
      }
    : isMediaMode
    ? {
        _id: 1,
        name: 1,
        price: 1,
        AED: 1,
        createdAt: 1,
        category: 1,
        categories: 1,
        images: { $slice: [{ $ifNull: ['$images', []] }, 1] },
        imageCount: { $size: { $ifNull: ['$images', []] } },
      }
    : {
        _id: 1,
        name: 1,
        sku: 1,
        price: 1,
        AED: 1,
        inStock: 1,
        createdAt: 1,
        images: { $slice: [{ $ifNull: ['$images', []] }, 1] },
        externalImages: { $slice: [{ $ifNull: ['$externalImages', []] }, 1] },
      };

  const scoreStage = useRelevanceSort ? buildPickerSearchScoreStage(trimmedSearch) : null;
  const pipeline = [{ $match: filter }];
  if (scoreStage) pipeline.push(scoreStage);
  pipeline.push(
    { $sort: sortOption },
    {
      $facet: {
        products: [
          { $skip: skip },
          { $limit: safeLimit },
          { $project: projection },
        ],
        total: [{ $count: 'count' }],
      },
    },
  );

  const [result] = await Product.aggregate(pipeline);

  const total = result?.total?.[0]?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const currentPage = Math.min(safePage, totalPages);

  return {
    products: (result?.products || []).map(trimProductImages),
    pagination: {
      page: currentPage,
      limit: safeLimit,
      total,
      totalPages,
    },
  };
}

export async function fetchPickerProductsByIds(Product, storeId, ids = []) {
  const normalizedIds = ids.map((id) => String(id || '').trim()).filter(Boolean).slice(0, 5);
  if (!normalizedIds.length) return [];

  const products = await Product.find({ storeId, _id: { $in: normalizedIds } })
    .select(PICKER_FIELDS)
    .lean();

  const productMap = new Map(products.map((product) => [String(product._id), trimProductImages(product)]));
  return normalizedIds.map((id) => productMap.get(id)).filter(Boolean);
}

export async function fetchPickerProductIds(Product, storeId, search = '', category = '') {
  const filter = buildPickerFilter(storeId, search, category);
  const productIds = await Product.distinct('_id', filter);
  return {
    productIds: productIds.map((id) => String(id)),
    total: productIds.length,
  };
}

export function flattenCategoriesMinimal(categories = []) {
  if (!Array.isArray(categories) || !categories.length) return [];

  const byParent = new Map();
  const byId = new Map();

  for (const category of categories) {
    const id = String(category?._id || category?.id || '').trim();
    if (!id) continue;

    const parentId = category?.parentId ? String(category.parentId) : '';
    byId.set(id, { id, name: String(category.name || '').trim(), parentId });

    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(id);
  }

  for (const ids of byParent.values()) {
    ids.sort((leftId, rightId) => {
      const leftName = byId.get(leftId)?.name || '';
      const rightName = byId.get(rightId)?.name || '';
      return leftName.localeCompare(rightName);
    });
  }

  const flattened = [];

  const walk = (parentId, depth) => {
    for (const id of byParent.get(parentId) || []) {
      const category = byId.get(id);
      if (!category) continue;
      flattened.push({ id: category.id, name: category.name, depth });
      walk(id, depth + 1);
    }
  };

  walk('', 0);
  return flattened;
}

export function pickHomeLayout(appearanceSections = {}) {
  const layout = appearanceSections?.homeMenuCategories || {};
  return {
    enabled: layout.enabled !== false,
    style: ['grid', 'list', 'carousel', 'horizontal'].includes(layout.style) ? layout.style : 'grid',
    itemsPerRow: Math.min(10, Math.max(1, Number(layout.itemsPerRow) || 5)),
    rows: Math.min(6, Math.max(1, Number(layout.rows) || 2)),
  };
}
