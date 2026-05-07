import mongoose from "mongoose";

const SpinLogSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    storeId: { type: String, required: true, index: true },
    spinDate: { type: String, required: true, index: true }, // UTC date key: YYYY-MM-DD
    rewardType: {
      type: String,
      enum: ["coupon_percent", "coupon_flat", "free_shipping", "no_win"],
      required: true,
    },
    couponCode: { type: String, default: null },
    sliceLabel: { type: String, required: true },
  },
  { timestamps: true }
);

SpinLogSchema.index({ userId: 1, storeId: 1, spinDate: 1 });

export default mongoose.models.SpinLog || mongoose.model("SpinLog", SpinLogSchema);
