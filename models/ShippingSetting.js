import mongoose from "mongoose";

const ShippingSettingSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, unique: true },
  enabled: { type: Boolean, default: true },
  shippingType: { type: String, default: "FLAT_RATE" },
  flatRate: { type: Number, default: 5 },
  perItemFee: { type: Number, default: 2 },
  maxItemFee: Number,
  weightUnit: { type: String, default: "kg" },
  baseWeight: { type: Number, default: 1 },
  baseWeightFee: { type: Number, default: 5 },
  additionalWeightFee: { type: Number, default: 2 },
  freeShippingMin: { type: Number, default: 499 },
  enableProductSpecificFreeShipping: { type: Boolean, default: false },
  productSpecificFreeShippingMode: {
    type: String,
    enum: ["ORDER_LEVEL", "MARKED_ITEMS_ONLY"],
    default: "ORDER_LEVEL"
  },
  localDeliveryFee: Number,
  regionalDeliveryFee: Number,
  estimatedDays: { type: String, default: "2-5" },
  enableCOD: { type: Boolean, default: true },
  codFee: { type: Number, default: 0 },
  maxCODAmount: { type: Number, default: 0 },
  enableExpressShipping: { type: Boolean, default: false },
  expressShippingFee: { type: Number, default: 20 },
  expressEstimatedDays: { type: String, default: "1-2" },
  stateCharges: [
    {
      state: { type: String, trim: true },
      fee: { type: Number, default: 0 }
    }
  ]
}, { timestamps: true });

export default mongoose.models.ShippingSetting || mongoose.model("ShippingSetting", ShippingSettingSchema);
