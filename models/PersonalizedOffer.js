import mongoose from "mongoose";

const PersonalizedOfferSchema = new mongoose.Schema({
  offerToken: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  customerEmail: { 
    type: String, 
    required: true 
  },
  customerPhone: String,
  customerName: String,
  productId: { 
    type: String, 
    required: true,
    index: true 
  },
  discountPercent: { 
    type: Number, 
    required: true,
    min: 0,
    max: 100 
  },
  expiresAt: { 
    type: Date, 
    required: true,
    index: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  isUsed: { 
    type: Boolean, 
    default: false 
  },
  usedAt: Date,
  orderId: String, // Track if customer made purchase with this offer
  notes: String, // Admin notes about this offer
  storeId: { 
    type: String, 
    required: true 
  },
}, { timestamps: true });

// Indexes for performance
PersonalizedOfferSchema.index({ customerEmail: 1, productId: 1 });
PersonalizedOfferSchema.index({ expiresAt: 1, isActive: 1 });
PersonalizedOfferSchema.index({ storeId: 1, isActive: 1 });

// Method to check if offer is valid
PersonalizedOfferSchema.methods.isValid = function() {
  return this.isActive && !this.isUsed && new Date() < new Date(this.expiresAt);
};

// Virtual for discounted price calculation
PersonalizedOfferSchema.methods.calculateDiscountedPrice = function(originalPrice) {
  const discount = (originalPrice * this.discountPercent) / 100;
  return Math.round((originalPrice - discount) * 100) / 100;
};

export default mongoose.models.PersonalizedOffer || mongoose.model("PersonalizedOffer", PersonalizedOfferSchema);
