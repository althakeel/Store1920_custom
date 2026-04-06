import mongoose from 'mongoose';

const IdentifierSchema = new mongoose.Schema({
  firebaseUid: { type: String, default: null },
  userId: { type: String, default: null },
  emailHash: { type: String, default: null },
  phoneHash: { type: String, default: null },
  source: { type: String, default: 'unknown' },
  fallbackNote: { type: String, default: '' },
}, { _id: false });

const ContextSchema = new mongoose.Schema({
  pageType: { type: String, default: null },
  pagePath: { type: String, default: null },
  productId: { type: String, default: null },
  quantity: { type: Number, default: 1 },
  value: { type: Number, default: 0 },
  currency: { type: String, default: 'AED' },
  sessionId: { type: String, default: null },
  anonymousId: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const CustomerBehaviorEventSchema = new mongoose.Schema({
  storeId: { type: String, required: true, index: true },
  eventType: { type: String, required: true, index: true },
  identifier: { type: IdentifierSchema, required: true },
  context: { type: ContextSchema, default: () => ({}) },
}, { timestamps: true });

CustomerBehaviorEventSchema.index({ storeId: 1, createdAt: -1 });
CustomerBehaviorEventSchema.index({ storeId: 1, eventType: 1, createdAt: -1 });
CustomerBehaviorEventSchema.index({ 'identifier.firebaseUid': 1, createdAt: -1 });
CustomerBehaviorEventSchema.index({ 'identifier.userId': 1, createdAt: -1 });
CustomerBehaviorEventSchema.index({ 'identifier.emailHash': 1, createdAt: -1 });
CustomerBehaviorEventSchema.index({ 'identifier.phoneHash': 1, createdAt: -1 });

export default mongoose.models.CustomerBehaviorEvent || mongoose.model('CustomerBehaviorEvent', CustomerBehaviorEventSchema);
