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
  // Add more fields as needed
}, { timestamps: true });

export default mongoose.models.Rating || mongoose.model("Rating", RatingSchema);
