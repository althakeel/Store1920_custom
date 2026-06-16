import mongoose from "mongoose";

const MarketingExpenseSchema = new mongoose.Schema({
  storeId: { type: String, required: true },
  campaignName: String,
  campaignType: { 
    type: String, 
    enum: ['AWARENESS', 'CONSIDERATION', 'CONVERSION', 'SALES', 'OTHER'],
    default: 'SALES'
  },
  platform: {
    type: String,
    enum: ['FACEBOOK', 'INSTAGRAM', 'GOOGLE', 'OTHER'],
    default: 'FACEBOOK'
  },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'AED' },
  clicks: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  reach: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  startDate: Date,
  endDate: Date,
  notes: String,
}, { timestamps: true });

// Indexes
MarketingExpenseSchema.index({ storeId: 1, createdAt: -1 });
MarketingExpenseSchema.index({ campaignType: 1 });
MarketingExpenseSchema.index({ platform: 1 });

export default mongoose.models.MarketingExpense || mongoose.model("MarketingExpense", MarketingExpenseSchema);
