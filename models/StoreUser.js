import mongoose from "mongoose";

const StoreUserSchema = new mongoose.Schema({
  storeId: { type: String, required: true },
  userId: { type: String }, // Null until invite is accepted
  username: { type: String, trim: true, lowercase: true, default: '' },
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
StoreUserSchema.index({ storeId: 1, username: 1 }, { unique: true, sparse: true });
StoreUserSchema.index({ username: 1, status: 1 });

export default mongoose.models.StoreUser || mongoose.model("StoreUser", StoreUserSchema);
