export function buildProductListSort(sort = 'newest') {
  switch (String(sort || 'newest')) {
    case 'priceLowToHigh':
      return { price: 1, createdAt: -1 }
    case 'priceHighToLow':
      return { price: -1, createdAt: -1 }
    case 'nameAZ':
      return { name: 1 }
    case 'nameZA':
      return { name: -1 }
    case 'newest':
    default:
      return { createdAt: -1 }
  }
}

export function applyShopPriceFilters(matchStage, { priceFilter = 'all', minPrice = '', maxPrice = '' } = {}) {
  const priceQuery = {}

  if (priceFilter === 'under499') {
    priceQuery.$lt = 499
  } else if (priceFilter === '500to999') {
    priceQuery.$gte = 500
    priceQuery.$lte = 999
  } else if (priceFilter === '1000to1999') {
    priceQuery.$gte = 1000
    priceQuery.$lte = 1999
  } else if (priceFilter === '2000plus') {
    priceQuery.$gte = 2000
  }

  const minValue = Number(minPrice)
  const maxValue = Number(maxPrice)
  if (Number.isFinite(minValue) && String(minPrice).trim() !== '') {
    priceQuery.$gte = priceQuery.$gte != null ? Math.max(priceQuery.$gte, minValue) : minValue
  }
  if (Number.isFinite(maxValue) && String(maxPrice).trim() !== '') {
    priceQuery.$lte = priceQuery.$lte != null ? Math.min(priceQuery.$lte, maxValue) : maxValue
  }

  if (Object.keys(priceQuery).length > 0) {
    matchStage.price = priceQuery
  }
}

export function collectDescendantCategoryIds(allCategories = [], rootCategoryId) {
  const rootId = String(rootCategoryId || '').trim();
  if (!rootId) return [];

  const ids = new Set([rootId]);
  let added = true;

  while (added) {
    added = false;
    for (const category of allCategories) {
      const id = String(category?._id || '').trim();
      const parentId = String(category?.parentId || '').trim();
      if (!id || !parentId || ids.has(id) || !ids.has(parentId)) continue;
      ids.add(id);
      added = true;
    }
  }

  return Array.from(ids);
}

export async function buildCategoryMatchConditions(categoryParam, Category) {
  if (!categoryParam) return []

  const normalizedName = categoryParam.replace(/-/g, ' ').trim()
  const slugWords = categoryParam
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const separator = '(?:\\s*&\\s*|\\s+|\\s+and\\s+)'
  const categoryRegex = new RegExp(slugWords.join(separator), 'i')

  const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const categoryDoc = await Category.findOne({
    $or: [
      { slug: categoryParam },
      { name: new RegExp(`^${escapedName}$`, 'i') },
      { nameAr: new RegExp(`^${escapedName}$`, 'i') },
    ],
  }).select('_id name nameAr slug').lean()

  return [
    ...(categoryDoc?._id ? [{ category: categoryDoc._id }, { categories: categoryDoc._id }] : []),
    ...(categoryDoc?.name ? [{ category: categoryDoc.name }, { categories: categoryDoc.name }] : []),
    ...(categoryDoc?.nameAr ? [{ category: categoryDoc.nameAr }, { categories: categoryDoc.nameAr }] : []),
    ...(categoryDoc?.slug ? [{ category: categoryDoc.slug }, { categories: categoryDoc.slug }] : []),
    { category: categoryParam },
    { categories: categoryParam },
    { category: normalizedName },
    { categories: normalizedName },
    { category: categoryRegex },
    { categories: categoryRegex },
  ]
}

export async function applyCategoryFilter(matchStage, categoryParam, Category) {
  const categoryConditions = await buildCategoryMatchConditions(categoryParam, Category)
  if (!categoryConditions.length) return

  if (!matchStage.$and) {
    matchStage.$and = []
  }
  matchStage.$and.push({ $or: categoryConditions })
}

export async function applyCategoriesFilter(matchStage, categoryParams, Category) {
  const slugs = Array.from(new Set(
    (Array.isArray(categoryParams) ? categoryParams : [categoryParams])
      .map((slug) => String(slug || '').trim())
      .filter(Boolean),
  ))

  if (!slugs.length) return

  const allCategories = await Category.find({ isActive: { $ne: false } })
    .select('_id parentId slug')
    .lean()

  const slugLookup = new Map(
    allCategories.map((category) => [String(category?.slug || '').trim().toLowerCase(), category]),
  )

  const matchedCategoryIds = new Set()
  const legacySlugs = []

  for (const slug of slugs) {
    const categoryDoc = slugLookup.get(slug.toLowerCase())
    if (categoryDoc?._id) {
      collectDescendantCategoryIds(allCategories, categoryDoc._id)
        .forEach((id) => matchedCategoryIds.add(id))
      continue
    }
    legacySlugs.push(slug)
  }

  const orConditions = []

  if (matchedCategoryIds.size) {
    const categoryIds = Array.from(matchedCategoryIds)
    orConditions.push(
      { category: { $in: categoryIds } },
      { categories: { $in: categoryIds } },
    )
  }

  for (const slug of legacySlugs) {
    const conditions = await buildCategoryMatchConditions(slug, Category)
    orConditions.push(...conditions)
  }

  if (!orConditions.length) return

  if (!matchStage.$and) {
    matchStage.$and = []
  }
  matchStage.$and.push({ $or: orConditions })
}

export function buildShopMatchStage({
  includeOutOfStock = false,
  fastDelivery = false,
  inStockOnly = false,
  bestSellerOnly = false,
  priceFilter = 'all',
  minPrice = '',
  maxPrice = '',
} = {}) {
  const matchStage = {}

  if (!includeOutOfStock || inStockOnly) {
    matchStage.inStock = true
  }

  if (fastDelivery) {
    matchStage.fastDelivery = true
  }

  if (bestSellerOnly) {
    if (!matchStage.$and) matchStage.$and = []
    matchStage.$and.push({
      $or: [
        { tags: { $regex: /bestseller|best seller|top seller/i } },
        { badges: { $regex: /best seller/i } },
      ],
    })
  }

  applyShopPriceFilters(matchStage, { priceFilter, minPrice, maxPrice })

  return matchStage
}

export function applyStorefrontVisibilityFilters(matchStage = {}) {
  matchStage.published = { $ne: false }
  return matchStage
}
