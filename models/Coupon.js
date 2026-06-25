import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema({
  legacySourceId: { type: String, default: null, index: true },
  code: { type: String, unique: true, required: true, uppercase: true },
  title: { type: String, required: true }, // e.g., "10% Off", "AED50 Off"
  description: { type: String, required: true }, // e.g., "Get 10% off on orders above AED500"
  storeId: String,
  discountType: { type: String, enum: ["percentage", "fixed"], required: true }, // percentage or fixed
  discountValue: { type: Number, required: true }, // 10 for 10% or 50 for AED50
  minOrderValue: { type: Number, default: 0 }, // Minimum order value to apply
  maxDiscount: { type: Number }, // Max discount cap for percentage type
  maxUses: { type: Number }, // Total times this coupon can be used
  usedCount: { type: Number, default: 0 },
  maxUsesPerUser: { type: Number, default: 1 }, // Times per user
  expiresAt: Date,
  isActive: { type: Boolean, default: true },
  freeShipping: { type: Boolean, default: false },
  savingsAmount: { type: Number }, // Display savings like "Save AED 75.00"
  badgeColor: { type: String, default: "green" }, // green, orange, purple, blue
  
  // Old schema fields for backward compatibility
  discount: { type: Number },
  minPrice: { type: Number },
  minProductCount: { type: Number },
  specificProducts: [{ type: String }], // Array of product IDs
  forNewUser: { type: Boolean, default: false },
  forMember: { type: Boolean, default: false },
  firstOrderOnly: { type: Boolean, default: false },
  oneTimePerUser: { type: Boolean, default: false },
  usageLimit: { type: Number },
  isPublic: { type: Boolean, default: true },
  assignedUserId: { type: String, default: '', index: true },
}, { timestamps: true });

// Indexes for query performance
CouponSchema.index({ code: 1, isActive: 1, expiresAt: 1 });        // Main validation on checkout
CouponSchema.index({ storeId: 1, isActive: 1, expiresAt: -1 });    // Store coupon listings
CouponSchema.index({ assignedUserId: 1, isActive: 1, expiresAt: -1 });
CouponSchema.index({ forNewUser: 1, isActive: 1 });                 // New-user coupon lookups

export default mongoose.models.Coupon || mongoose.model("Coupon", CouponSchema);
