import mongoose from 'mongoose';

const RazorpayPaymentClaimSchema = new mongoose.Schema({
  // The provider payment id is the Mongo primary key, so uniqueness is enforced
  // even before secondary indexes have been built in a new environment.
  _id: { type: String, required: true },
  razorpayOrderId: { type: String, required: true },
  requestFingerprint: { type: String, required: true },
  state: {
    type: String,
    enum: ['PROCESSING', 'COMPLETED', 'FAILED', 'BLOCKED'],
    default: 'PROCESSING',
    index: true,
  },
  orderIds: { type: [String], default: [] },
  leaseExpiresAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  lastError: { type: String, default: null },
}, { timestamps: true });

export default mongoose.models.RazorpayPaymentClaim
  || mongoose.model('RazorpayPaymentClaim', RazorpayPaymentClaimSchema);
