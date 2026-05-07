import mongoose from "mongoose";

const BrowseHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  productId: { type: String, required: true },
  viewedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Compound index for efficient queries
BrowseHistorySchema.index({ userId: 1, viewedAt: -1 });

// Unique constraint to avoid duplicates
BrowseHistorySchema.index({ userId: 1, productId: 1 }, { unique: true });
// TTL: auto-delete entries older than 90 days to control collection size
BrowseHistorySchema.index({ viewedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.models.BrowseHistory || mongoose.model("BrowseHistory", BrowseHistorySchema);
