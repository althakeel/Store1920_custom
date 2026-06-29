import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  price: Number,
  quantity: Number,
  variantOptions: { type: Object, default: null },
  // Add more fields as needed
}, { _id: false });

const RazorpaySettlementSchema = new mongoose.Schema({
  paymentId: String,                    // Razorpay payment ID
  status: String,                       // TRANSFERRED, PENDING, FAILED
  captured_at: Date,                    // When payment was captured
  amount: Number,                       // Amount paid
  fee: { type: Number, default: 0 },   // Razorpay processing fee
  is_transferred: { type: Boolean, default: false }, // Is amount transferred to bank?
  transferred_at: Date,                 // When transferred to bank account
  transfer_id: String,                  // Razorpay transfer ID
  amount_transferred: Number,           // Amount that reached bank
  recipient_id: String                  // Bank account identifier
}, { _id: false, timestamps: false });

const OrderSchema = new mongoose.Schema({
  storeId: { type: String, required: true },
  legacySourceId: { type: String, default: null, index: true },
  userId: String,
  addressId: String,
  total: { type: Number, default: 0 },
  shippingFee: { type: Number, default: 0 },
  status: { type: String, default: "ORDER_PLACED", index: true },
  paymentMethod: String,
  paymentStatus: String,
  isPaid: { type: Boolean, default: false },
  isCouponUsed: { type: Boolean, default: false },
  coupon: Object,
  isGuest: { type: Boolean, default: false },
  guestName: String,
  guestEmail: String,
  guestPhone: String,
  alternatePhone: String,
  alternatePhoneCode: String,
  shippingAddress: Object,
  trackingId: { type: String, index: true },
  courier: String,
  trackingUrl: String,
  shortOrderNumber: { type: Number, index: true },
  orderItems: [OrderItemSchema],
  items: Array,
  cancelReason: String,
  paymentRecoveryNotifiedAt: { type: Date, default: null },
  orderPlacedEmailSentAt: { type: Date, default: null },
  metaPurchaseSentAt: { type: Date, default: null },
  orderConfirmedEmailSentAt: { type: Date, default: null },
  adminOrderEmailSentAt: { type: Date, default: null },
  returnReason: String,
  notes: String,
  coinsRedeemed: { type: Number, default: 0 },
  walletDiscount: { type: Number, default: 0 },
  coinsEarned: { type: Number, default: 0 },
  rewardsCredited: { type: Boolean, default: false },
  
  // Razorpay Payment Fields
  razorpayPaymentId: { type: String, index: true },        // Razorpay payment ID (if card payment)
  razorpayOrderId: String,                                  // Razorpay order ID
  razorpaySignature: String,                                // Webhook signature for verification
  razorpaySettlement: RazorpaySettlementSchema,            // Settlement details

  // Tamara BNPL
  tamaraOrderId: { type: String, index: true },             // Tamara order ID (if BNPL payment)
  tabbyPaymentId: { type: String, index: true },            // Tabby payment ID (if BNPL payment)
  
  // Return & Replacement
  returns: [{
    itemIndex: Number,
    reason: String,
    type: { type: String, enum: ['RETURN', 'REPLACEMENT'], default: 'RETURN' },
    status: { type: String, enum: ['REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'], default: 'REQUESTED' },
    description: String,
    images: [String],
    requestedAt: { type: Date, default: Date.now },
    approvedAt: Date,
    rejectionReason: String,
    sellerNotes: String,
  }],

  // Delivery Reviews
  deliveryReviews: [{
    userId: String,
    rating: { type: Number, min: 1, max: 5 },
    reviewText: String,
    images: [String],
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date,
  }],
  averageDeliveryRating: { type: Number, default: 0 },

  trackingContext: {
    anonymousId: { type: String, default: null },
    sessionId: { type: String, default: null },
  },
  attribution: {
    utmSource: { type: String, default: null },
    utmMedium: { type: String, default: null },
    utmCampaign: { type: String, default: null },
    utmContent: { type: String, default: null },
    utmTerm: { type: String, default: null },
    utmId: { type: String, default: null },
    utmReferrer: { type: String, default: null },
  },

  manualStoreOrder: { type: Boolean, default: false },
  storeCreatedByUid: { type: String, default: null },
  storeCreatedByName: { type: String, default: null },
  paymentReferenceId: { type: String, default: null },

  communicationLog: [{
    channel: { type: String, default: 'system' },
    template: { type: String, default: '' },
    label: { type: String, default: '' },
    status: { type: String, default: 'sent' },
    recipient: { type: String, default: '' },
    sentByUid: { type: String, default: null },
    sentByName: { type: String, default: 'System' },
    details: { type: String, default: '' },
    sentAt: { type: Date, default: Date.now },
  }],

  paymentFailedFollowUp: {
    reason: { type: String, default: null },
    discountAmount: { type: Number, default: null },
    discountType: { type: String, default: null },
    discountValue: { type: Number, default: null },
    originalTotal: { type: Number, default: null },
    adjustedTotal: { type: Number, default: null },
    savedAt: { type: Date, default: null },
    savedByUid: { type: String, default: null },
    savedByName: { type: String, default: null },
    savedByEmail: { type: String, default: null },
    paymentMethod: { type: String, default: null },
    previousPaymentMethod: { type: String, default: null },
  },

  deletedAt: { type: Date, default: null, index: true },
  deletedBy: { type: String, default: null },
  deletedByName: { type: String, default: null },

  // Add more fields as needed
}, { timestamps: true });

// Indexes for query performance
OrderSchema.index({ userId: 1, createdAt: -1 });              // Fetch user orders sorted by date
OrderSchema.index({ userId: 1, status: 1 });                  // Filter user orders by status
OrderSchema.index({ userId: 1, isCouponUsed: 1 });            // Coupon eligibility checks
OrderSchema.index({ storeId: 1, createdAt: -1 });             // Store order history
OrderSchema.index({ storeId: 1, status: 1, createdAt: -1 }); // Store dashboard filtered by status
OrderSchema.index({ status: 1, createdAt: -1 });              // Global status queries / admin
OrderSchema.index({ userId: 1, 'coupon.code': 1 });           // Per-user coupon usage checks
OrderSchema.index({ isGuest: 1, guestEmail: 1 });             // Link guest orders by email
OrderSchema.index({ storeId: 1, deletedAt: 1, createdAt: -1 });
OrderSchema.index({ isGuest: 1, guestPhone: 1 });             // Link guest orders by phone

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
