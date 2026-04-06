import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  price: Number,
  quantity: Number,
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
  // Add more fields as needed
}, { timestamps: true });

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
