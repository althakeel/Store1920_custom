import mongoose from 'mongoose'

const ProductImageMigrationJobSchema = new mongoose.Schema({
  storeId: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
    default: 'queued',
    index: true,
  },
  totalProducts: { type: Number, default: 0 },
  processedSkip: { type: Number, default: 0 },
  productsUpdated: { type: Number, default: 0 },
  imagesMirrored: { type: Number, default: 0 },
  imagesFailed: { type: Number, default: 0 },
  failures: {
    type: [{
      productId: String,
      productName: String,
      url: String,
      reason: String,
    }],
    default: [],
  },
  message: { type: String, default: '' },
  error: { type: String, default: null },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true })

ProductImageMigrationJobSchema.index({ storeId: 1, createdAt: -1 })

export default mongoose.models.ProductImageMigrationJob
  || mongoose.model('ProductImageMigrationJob', ProductImageMigrationJobSchema)
