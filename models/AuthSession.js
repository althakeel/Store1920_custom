import mongoose from 'mongoose';

const AuthSessionSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, unique: true, index: true },
    deviceLabel: { type: String, default: 'Unknown device' },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    current: { type: Boolean, default: false },
  },
  { timestamps: false },
);

AuthSessionSchema.index({ uid: 1, revokedAt: 1, expiresAt: 1 });

export default mongoose.models.AuthSession
  || mongoose.model('AuthSession', AuthSessionSchema);
