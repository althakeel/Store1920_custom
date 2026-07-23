import connectDB from '@/lib/mongodb';
import AuthSession from '@/models/AuthSession';
import {
  SESSION_MAX_MS,
  generateToken,
  getClientIp,
  parseDeviceLabel,
} from '@/lib/authSecurity';
import { getAuth } from '@/lib/firebase-admin';

export async function createAuthSession(uid, request, { sessionId } = {}) {
  await connectDB();
  const id = sessionId || generateToken(24);
  const userAgent = request.headers.get('user-agent') || '';
  const ip = getClientIp(request);
  const expiresAt = new Date(Date.now() + SESSION_MAX_MS);

  await AuthSession.updateMany({ uid, current: true }, { $set: { current: false } });

  const session = await AuthSession.create({
    uid,
    sessionId: id,
    deviceLabel: parseDeviceLabel(userAgent),
    userAgent: userAgent.slice(0, 500),
    ip,
    expiresAt,
    current: true,
    lastSeenAt: new Date(),
  });

  return session;
}

export async function touchAuthSession(uid, sessionId) {
  if (!uid || !sessionId) return null;
  await connectDB();
  return AuthSession.findOneAndUpdate(
    {
      uid,
      sessionId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { lastSeenAt: new Date() } },
    { new: true },
  ).lean();
}

export async function listAuthSessions(uid) {
  await connectDB();
  return AuthSession.find({
    uid,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ lastSeenAt: -1 })
    .lean();
}

export async function revokeAuthSession(uid, sessionId) {
  await connectDB();
  return AuthSession.findOneAndUpdate(
    { uid, sessionId, revokedAt: null },
    { $set: { revokedAt: new Date(), current: false } },
    { new: true },
  ).lean();
}

export async function revokeAllAuthSessions(uid, { exceptSessionId = null } = {}) {
  await connectDB();
  const filter = { uid, revokedAt: null };
  if (exceptSessionId) filter.sessionId = { $ne: exceptSessionId };
  await AuthSession.updateMany(filter, {
    $set: { revokedAt: new Date(), current: false },
  });

  // Invalidate Firebase refresh tokens so other devices must sign in again
  try {
    await getAuth().revokeRefreshTokens(uid);
  } catch (error) {
    console.warn('[authSessions] revokeRefreshTokens failed:', error?.message || error);
  }

  return { ok: true };
}

export function isSessionExpired(session, idleMs) {
  if (!session) return true;
  if (session.revokedAt) return true;
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) return true;
  if (idleMs && session.lastSeenAt) {
    const last = new Date(session.lastSeenAt).getTime();
    if (Date.now() - last > idleMs) return true;
  }
  return false;
}
