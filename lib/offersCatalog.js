import { localizeRecord } from '@/lib/storefrontLanguage';
import {
  applyStorefrontVisibilityFilters,
  buildShopMatchStage,
} from '@/lib/shopProductQuery';
import { buildSkuDedupeKeyAddFieldsStage } from '@/lib/productSkuDedupe';

export const OFFERS_PAGE_SIZE = 24;
export const OFFERS_MIN_DISCOUNT_PERCENT = 60;

export function buildOffersDiscountAddFieldsStage() {
  return {
    $addFields: {
      __discountPct: {
        $cond: [
          {
            $and: [
              { $gt: [{ $ifNull: ['$AED', 0] }, 0] },
              { $gt: [{ $ifNull: ['$price', 0] }, 0] },
              { $gt: ['$AED', '$price'] },
            ],
          },
          {
            $multiply: [
              { $divide: [{ $subtract: ['$AED', '$price'] }, '$AED'] },
              100,
            ],
          },
          0,
        ],
      },
    },
  };
}

function buildOffersBaseMatchStage(minDiscount = OFFERS_MIN_DISCOUNT_PERCENT) {
  const matchStage = applyStorefrontVisibilityFilters(buildShopMatchStage({}));
  return { matchStage, minDiscount };
}

function buildOffersPipeline(minDiscount) {
  const { matchStage } = buildOffersBaseMatchStage(minDiscount);

  return [
    { $match: matchStage },
    buildOffersDiscountAddFieldsStage(),
    { $match: { __discountPct: { $gt: minDiscount } } },
    buildSkuDedupeKeyAddFieldsStage(),
    { $sort: { __discountPct: -1, inStock: -1, createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: '$__skuDedupeKey',
        doc: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: { __discountPct: -1, _id: -1 } },
  ];
}

export async function countOffersProducts(Product, minDiscount = OFFERS_MIN_DISCOUNT_PERCENT) {
  const result = await Product.aggregate([
    ...buildOffersPipeline(minDiscount),
    { $count: 'total' },
  ]);

  return Number(result?.[0]?.total) || 0;
}

export async function fetchOffersProducts(
  Product,
  { page = 1, limit = OFFERS_PAGE_SIZE, minDiscount = OFFERS_MIN_DISCOUNT_PERCENT } = {},
) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 48) : OFFERS_PAGE_SIZE;
  const skip = (safePage - 1) * safeLimit;

  const pipeline = buildOffersPipeline(minDiscount);

  const [countResult, products] = await Promise.all([
    Product.aggregate([...pipeline, { $count: 'total' }]),
    Product.aggregate([
      ...pipeline,
      { $skip: skip },
      { $limit: safeLimit },
      {
        $project: {
          __skuDedupeKey: 0,
        },
      },
    ]),
  ]);

  const total = Number(countResult?.[0]?.total) || 0;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  return {
    products,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
  };
}

export function normalizeOfferProduct(product, language = 'en') {
  const localized = localizeRecord(product, language, [
    'name',
    'description',
    'shortDescription',
    'brand',
  ]);

  const discount = Math.round(Number(product?.__discountPct || 0));

  return {
    ...localized,
    discount: discount > 0 ? discount : null,
  };
}
