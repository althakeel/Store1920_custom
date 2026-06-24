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
  status: { type: String, enum: ['active', 'pending_payment', 'converted'], default: 'active', index: true },
  convertedAt: { type: Date, default: null },
  convertedBy: { type: String, default: null },
  convertedByName: { type: String, default: null },
  convertedCartTotal: { type: Number, default: null },
  conversionNote: { type: String, default: null },
  conversionDiscountType: { type: String, enum: ['none', 'amount', 'percent', 'custom'], default: null },
  conversionDiscountValue: { type: Number, default: null },
  conversionPaymentMethod: {
    type: String,
    enum: ['cod', 'card', 'stripe', 'tabby', 'tamara'],
    default: null,
  },
  conversionPaymentLink: { type: String, default: null },
  conversionPaymentLinkId: { type: String, default: null },
  conversionCustomerEmail: { type: String, default: null },
  conversionEmailSent: { type: Boolean, default: false },
  conversionEmailSentAt: { type: Date, default: null },
  conversionEmailError: { type: String, default: null },
  linkedOrderId: { type: String, default: null, index: true },
  recoveryToken: { type: String, default: null, index: true, sparse: true },
  recoveryDiscountType: { type: String, enum: ['none', 'amount', 'percent', 'custom'], default: null },
  recoveryDiscountValue: { type: Number, default: null },
  recoveryCartTotal: { type: Number, default: null },
  recoveryOfferTotal: { type: Number, default: null },
  recoveryLinkExpiresAt: { type: Date, default: null },
  recoveryLinkSentAt: { type: Date, default: null },
  recoveryLinkSentTo: { type: String, default: null },
}, { timestamps: true });

// Indexes for query performance
AbandonedCartSchema.index({ storeId: 1, lastSeenAt: -1 });
AbandonedCartSchema.index({ storeId: 1, userId: 1, lastSeenAt: -1 }); // User-specific cart recovery
AbandonedCartSchema.index({ storeId: 1, email: 1 });                  // Email recovery campaigns
AbandonedCartSchema.index({ storeId: 1, createdAt: -1 });             // Time-based purging
// TTL: auto-delete abandoned carts older than 30 days
AbandonedCartSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.models.AbandonedCart || mongoose.model("AbandonedCart", AbandonedCartSchema);
