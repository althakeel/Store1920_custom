import mongoose from 'mongoose';

const BehavioralTriggerLogSchema = new mongoose.Schema({
  storeId: { type: String, required: true, index: true },
  triggerId: { type: String, required: true, index: true },
  customerKey: { type: String, required: true, index: true },
  customerName: { type: String, default: '' },
  customerEmail: { type: String, default: '' },
  subject: { type: String, default: '' },
  status: { type: String, enum: ['sent', 'failed', 'skipped'], default: 'sent', index: true },
  errorMessage: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  sentAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

BehavioralTriggerLogSchema.index({ storeId: 1, triggerId: 1, customerKey: 1, sentAt: -1 });
BehavioralTriggerLogSchema.index({ storeId: 1, sentAt: -1 });

export default mongoose.models.BehavioralTriggerLog
  || mongoose.model('BehavioralTriggerLog', BehavioralTriggerLogSchema);
