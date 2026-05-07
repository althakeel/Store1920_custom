import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema({
  userId: String,
  name: String,
  email: String,
  street: String,
  city: String,
  state: String,
  district: String,
  zip: String,
  country: String,
  phone: String,
  phoneCode: String,
  alternatePhone: String,
  alternatePhoneCode: String,
}, { timestamps: true });

// Index for query performance
AddressSchema.index({ userId: 1, createdAt: -1 }); // Fetch user addresses sorted by date

export default mongoose.models.Address || mongoose.model("Address", AddressSchema);