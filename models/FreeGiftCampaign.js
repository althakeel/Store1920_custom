import mongoose from 'mongoose';

const FreeGiftCampaignSchema = new mongoose.Schema(
  {
    storeId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
    giftProductId: { type: String, required: true, trim: true },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    triggerMode: {
      type: String,
      enum: ['any_product', 'specific_products'],
      default: 'any_product',
    },
    triggerProductIds: { type: [String], default: [] },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

FreeGiftCampaignSchema.index({ storeId: 1, isActive: 1, updatedAt: -1 });

export default mongoose.models.FreeGiftCampaign || mongoose.model('FreeGiftCampaign', FreeGiftCampaignSchema);