import mongoose from "mongoose";

const RatingSchema = new mongoose.Schema({
  legacySourceId: { type: String, default: null, index: true },
  productId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.Mixed, required: true, ref: 'User' }, // Accepts ObjectId or String (for guest reviews)
  orderId: String,
  rating: { type: Number, required: true },
  comment: String,
  review: String,
  images: [String],
  videos: [String],
  approved: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  customerName: String, // For manually added reviews
  customerEmail: String, // For manually added reviews
  helpfulCount: { type: Number, default: 0 },
  helpfulVoters: { type: [String], default: [] },
  // Add more fields as needed
}, { timestamps: true });

// Indexes for query performance
RatingSchema.index({ productId: 1, approved: 1, createdAt: -1 }); // Product page review list
RatingSchema.index({ productId: 1, userId: 1 });        // Check if user already rated a product
RatingSchema.index({ userId: 1, createdAt: -1 });       // User's rating history
RatingSchema.index({ orderId: 1 });                     // Look up ratings by order
RatingSchema.index({ approved: 1, createdAt: -1 });     // Admin review queue

export default mongoose.models.Rating || mongoose.model("Rating", RatingSchema);
