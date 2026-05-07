import mongoose from "mongoose";

const SpinSliceSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    color: { type: String, default: "#6366f1", trim: true },
    weight: { type: Number, required: true, min: 1 },
    rewardType: {
      type: String,
      enum: ["coupon_percent", "coupon_flat", "free_shipping", "no_win"],
      required: true,
    },
    discountValue: { type: Number, default: 0, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    expiryHours: { type: Number, default: 48, min: 1, max: 720 },
  },
  { _id: false }
);

const SpinCampaignSchema = new mongoose.Schema(
  {
    storeId: { type: String, required: true, unique: true, index: true },
    isEnabled: { type: Boolean, default: false },
    campaignName: { type: String, default: "Spin & Win", trim: true },
    couponPrefix: { type: String, default: "SPIN", uppercase: true, trim: true },
    dailySpinLimit: { type: Number, default: 1, min: 1, max: 10 },
    spinInterval: { type: String, enum: ["daily", "weekly", "monthly", "unlimited"], default: "daily" },
    homePageOnly: { type: Boolean, default: false },
    showAfterSeconds: { type: Number, default: 0, min: 0, max: 300 },
    slices: { type: [SpinSliceSchema], default: [] },
  },
  { timestamps: true }
);

SpinCampaignSchema.index({ isEnabled: 1, updatedAt: -1 });

export default mongoose.models.SpinCampaign || mongoose.model("SpinCampaign", SpinCampaignSchema);
