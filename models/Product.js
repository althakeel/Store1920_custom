import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  name: String,
  nameAr: { type: String, default: '' },
  legacySourceId: { type: String, default: null, index: true },
  slug: { type: String, unique: true },
  brand: { type: String, default: '' },
  brandAr: { type: String, default: '' },
  description: String,
  descriptionAr: { type: String, default: '' },
  shortDescription: String,
  shortDescriptionAr: { type: String, default: '' },
  AED: Number,
  price: Number,
  costPrice: { type: Number, default: 0 }, // Actual cost/purchase price for profit calculation
  images: [String],
  externalImages: { type: [String], default: [] },
  imageImportStatus: { type: Object, default: {} },
  category: { type: String, ref: 'Category' },
  categories: { type: [String], default: [] }, // Multiple categories support
  sku: String,
  inStock: { type: Boolean, default: true },
  stockQuantity: { type: Number, default: 0 },
  hasVariants: { type: Boolean, default: false },
  variants: { type: Array, default: [] },
  attributes: { type: Object, default: {} },
  hasBulkPricing: { type: Boolean, default: false },
  bulkPricing: { type: Array, default: [] },
  fastDelivery: { type: Boolean, default: false },
  freeShippingEligible: { type: Boolean, default: false },
  allowReturn: { type: Boolean, default: true },
  allowReplacement: { type: Boolean, default: true },
  imageAspectRatio: { type: String, default: '1:1' },
  storeId: String,
  tags: { type: [String], default: [] },
  // Frequently Bought Together fields
  enableFBT: { type: Boolean, default: false },
  fbtProductIds: { type: [String], default: [] },
  fbtBundlePrice: { type: Number, default: null },
  fbtBundleDiscount: { type: Number, default: null },
  wooImport: { type: Object, default: {} },
}, { timestamps: true });

// Add indexes for better query performance
ProductSchema.index({ inStock: 1, createdAt: -1 });
ProductSchema.index({ storeId: 1, inStock: 1 });
ProductSchema.index({ category: 1, inStock: 1 }); // For category filtering
ProductSchema.index({ price: 1, AED: 1 }); // For discount calculations and price sorting
ProductSchema.index({ tags: 1, inStock: 1 }); // For tag-based filtering
ProductSchema.index({ fastDelivery: 1, inStock: 1 }); // For fast delivery filter

export default mongoose.models.Product || mongoose.model("Product", ProductSchema);