import mongoose from 'mongoose';

const FactorSchema = new mongoose.Schema({
  recency: { type: Number, default: 0 },
  frequency: { type: Number, default: 0 },
  monetary: { type: Number, default: 0 },
  engagement: { type: Number, default: 0 },
}, { _id: false });

const CustomerChurnScoreSchema = new mongoose.Schema({
  storeId: { type: String, required: true, index: true },
  customerKey: { type: String, required: true },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  churnScore: { type: Number, default: 0, index: true },
  riskLevel: {
    type: String,
    enum: ['healthy', 'watch', 'elevated', 'high'],
    default: 'healthy',
    index: true,
  },
  factors: { type: FactorSchema, default: () => ({}) },
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  daysSinceLastOrder: { type: Number, default: null },
  daysSinceLastSeen: { type: Number, default: null },
  lastOrderAt: { type: Date, default: null },
  lastSeenAt: { type: Date, default: null },
  recommendation: { type: String, default: '' },
  computedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

CustomerChurnScoreSchema.index({ storeId: 1, customerKey: 1 }, { unique: true });
CustomerChurnScoreSchema.index({ storeId: 1, churnScore: -1 });

export default mongoose.models.CustomerChurnScore
  || mongoose.model('CustomerChurnScore', CustomerChurnScoreSchema);
