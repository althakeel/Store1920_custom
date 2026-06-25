import mongoose from 'mongoose';

const RecentResultSchema = new mongoose.Schema({
  productId: String,
  name: String,
  success: Boolean,
  error: String,
  updatedFields: [String],
  at: { type: Date, default: Date.now },
}, { _id: false });

const ProductAiAutofillJobSchema = new mongoose.Schema({
  storeId: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ['running', 'paused', 'completed', 'cancelled'],
    default: 'running',
    index: true,
  },
  includeArabic: { type: Boolean, default: true },
  intervalMs: { type: Number, default: 60000 },
  productIds: { type: [String], default: [] },
  currentIndex: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  lastProcessedAt: { type: Date, default: null },
  nextProcessAt: { type: Date, default: null },
  currentProductId: { type: String, default: '' },
  currentProductName: { type: String, default: '' },
  recentResults: { type: [RecentResultSchema], default: [] },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

ProductAiAutofillJobSchema.index({ storeId: 1, status: 1 });

export default mongoose.models.ProductAiAutofillJob
  || mongoose.model('ProductAiAutofillJob', ProductAiAutofillJobSchema);
