import mongoose from "mongoose";

const AbandonedCartSchema = new mongoose.Schema({
  storeId: { type: String, required: true },
  userId: String,
  name: { type: String, default: null },
  email: { type: String, default: null },
  phone: String,
  address: Object,
  items: Array,
  cartTotal: Number,
  currency: String,
  lastSeenAt: Date,
  source: { type: String, default: 'checkout' },
}, { timestamps: true });

// Indexes for query performance
AbandonedCartSchema.index({ storeId: 1, lastSeenAt: -1 });
AbandonedCartSchema.index({ storeId: 1, userId: 1, lastSeenAt: -1 }); // User-specific cart recovery
AbandonedCartSchema.index({ storeId: 1, email: 1 });                  // Email recovery campaigns
AbandonedCartSchema.index({ storeId: 1, createdAt: -1 });             // Time-based purging
// TTL: auto-delete abandoned carts older than 30 days
AbandonedCartSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.models.AbandonedCart || mongoose.model("AbandonedCart", AbandonedCartSchema);
