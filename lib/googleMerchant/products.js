import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import { applyStorefrontPublishedFilter } from '@/lib/productVisibility';

export async function fetchGoogleMerchantCatalogProducts({
  storeId = '',
  limit = 5000,
  inStockOnly = false,
} = {}) {
  await connectDB();

  const filter = applyStorefrontPublishedFilter({});
  if (storeId) {
    filter.storeId = String(storeId);
  }
  if (inStockOnly) {
    filter.inStock = { $ne: false };
  }

  return Product.find(filter)
    .select('name description shortDescription slug sku price AED images brand useProductsPath inStock published storeId')
    .sort({ updatedAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 5000, 1), 50000))
    .lean();
}
