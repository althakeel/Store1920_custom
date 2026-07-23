import mongoose from 'mongoose';

/**
 * Append-only payment audit trail. Never stores PAN/CVV — only provider tokens/IDs.
 */
const PaymentTransactionLogSchema = new mongoose.Schema(
  {
    storeId: { type: String, index: true, default: '' },
    orderId: { type: String, index: true, default: '' },
    eventType: {
      type: String,
      required: true,
      index: true,
      enum: [
        'CHECKOUT_STARTED',
        'SESSION_CREATED',
        'PAYMENT_VERIFIED',
        'WEBHOOK_RECEIVED',
        'FRAUD_FLAGGED',
        'FRAUD_BLOCKED',
        'REFUND_REQUESTED',
        'REFUND_APPROVED',
        'REFUND_REJECTED',
        'REFUND_EXECUTED',
        'REFUND_FAILED',
        'REVERSAL',
        'DISPUTE',
        'SECURITY_NOTE',
      ],
    },
    provider: {
      type: String,
      enum: ['STRIPE', 'TABBY', 'TAMARA', 'RAZORPAY', 'COD', 'WALLET', 'SYSTEM', ''],
      default: '',
      index: true,
    },
    providerReference: { type: String, default: '', index: true },
    amount: { type: Number, default: null },
    currency: { type: String, default: 'AED' },
    status: { type: String, default: '' },
    actorUserId: { type: String, default: '' },
    actorRole: { type: String, default: '' },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    /** Sanitized metadata only — never card numbers */
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    riskScore: { type: Number, default: null },
    riskSignals: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

PaymentTransactionLogSchema.index({ createdAt: -1 });
PaymentTransactionLogSchema.index({ orderId: 1, createdAt: -1 });

export default mongoose.models.PaymentTransactionLog
  || mongoose.model('PaymentTransactionLog', PaymentTransactionLogSchema);
