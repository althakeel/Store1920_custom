import mongoose from "mongoose";

const WishlistItemSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  productId: { type: String, required: true },
  // Add more fields as needed
}, { timestamps: true });

// Indexes for query performance
WishlistItemSchema.index({ userId: 1, createdAt: -1 });                         // Fetch user wishlist sorted by date
WishlistItemSchema.index({ userId: 1, productId: 1 }, { unique: true });        // Prevent duplicate wishlist entries

export default mongoose.models.WishlistItem || mongoose.model("WishlistItem", WishlistItemSchema);
