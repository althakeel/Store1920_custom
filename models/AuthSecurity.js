import mongoose from 'mongoose';

const AuthSecuritySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true }, // email or uid
    keyType: { type: String, enum: ['email', 'uid', 'ip'], default: 'email' },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastFailedAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    mfaSecret: { type: String, default: '' }, // reserved / hashed seed
    emailVerifiedAt: { type: Date, default: null },
    phoneVerifiedAt: { type: Date, default: null },
    phoneE164: { type: String, default: '' },
  },
  { timestamps: true },
);

export default mongoose.models.AuthSecurity
  || mongoose.model('AuthSecurity', AuthSecuritySchema);
