import mongoose from 'mongoose';

const CustomerRfmScoreSchema = new mongoose.Schema({
  storeId: { type: String, required: true, index: true },
  customerKey: { type: String, required: true },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  recencyScore: { type: Number, default: 1, min: 1, max: 5 },
  frequencyScore: { type: Number, default: 1, min: 1, max: 5 },
  monetaryScore: { type: Number, default: 1, min: 1, max: 5 },
  rfmScore: { type: String, default: '1-1-1' },
  rfmTotal: { type: Number, default: 3, index: true },
  segment: { type: String, default: 'needs_attention', index: true },
  daysSinceLastOrder: { type: Number, default: null },
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  lastOrderAt: { type: Date, default: null },
  recommendation: { type: String, default: '' },
  computedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

CustomerRfmScoreSchema.index({ storeId: 1, customerKey: 1 }, { unique: true });
CustomerRfmScoreSchema.index({ storeId: 1, segment: 1 });
CustomerRfmScoreSchema.index({ storeId: 1, rfmTotal: -1 });

export default mongoose.models.CustomerRfmScore
  || mongoose.model('CustomerRfmScore', CustomerRfmScoreSchema);
