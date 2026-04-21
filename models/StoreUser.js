import mongoose from "mongoose";

const StoreUserSchema = new mongoose.Schema({
  storeId: { type: String, required: true },
  userId: { type: String }, // Null until invite is accepted
  email: { type: String, required: true },
  role: { type: String, default: "member" }, // 'admin' or 'member'
  permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, default: "invited" }, // 'invited', 'pending', 'approved', 'rejected', 'removed'
  invitedById: { type: String },
  approvedById: { type: String },
  inviteToken: { type: String, unique: true, sparse: true },
  inviteExpiry: { type: Date },
}, { timestamps: true });

// Ensure unique email per store
StoreUserSchema.index({ storeId: 1, email: 1 }, { unique: true });

export default mongoose.models.StoreUser || mongoose.model("StoreUser", StoreUserSchema);
