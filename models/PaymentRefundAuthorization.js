import mongoose from 'mongoose';

const PaymentRefundAuthorizationSchema = new mongoose.Schema(
  {
    storeId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    provider: {
      type: String,
      enum: ['STRIPE', 'TABBY', 'TAMARA', 'RAZORPAY'],
      required: true,
    },
    providerReference: { type: String, default: '' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'AED' },
    reason: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    requestedByUserId: { type: String, required: true },
    requestedByEmail: { type: String, default: '' },
    approvedByUserId: { type: String, default: '' },
    approvedByEmail: { type: String, default: '' },
    rejectedByUserId: { type: String, default: '' },
    rejectReason: { type: String, default: '' },
    providerRefundId: { type: String, default: '' },
    executedAt: { type: Date, default: null },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true },
);

PaymentRefundAuthorizationSchema.index({ storeId: 1, status: 1, createdAt: -1 });

export default mongoose.models.PaymentRefundAuthorization
  || mongoose.model('PaymentRefundAuthorization', PaymentRefundAuthorizationSchema);
