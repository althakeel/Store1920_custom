import mongoose from 'mongoose';

const TriggerSettingSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  subject: { type: String, default: '' },
  bodyHtml: { type: String, default: '' },
  channel: { type: String, enum: ['email'], default: 'email' },
  daysInactive: { type: Number, default: 90 },
  daysAfterFirst: { type: Number, default: 14 },
}, { _id: false });

const BehavioralTriggerSettingsSchema = new mongoose.Schema({
  storeId: { type: String, required: true, unique: true, index: true },
  triggers: {
    type: Map,
    of: TriggerSettingSchema,
    default: {},
  },
}, { timestamps: true });

export default mongoose.models.BehavioralTriggerSettings
  || mongoose.model('BehavioralTriggerSettings', BehavioralTriggerSettingsSchema);
