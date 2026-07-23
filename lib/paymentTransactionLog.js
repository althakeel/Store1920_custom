import connectDB from '@/lib/mongodb';
import PaymentTransactionLog from '@/models/PaymentTransactionLog';
import { sanitizePaymentPayload } from '@/lib/paymentSecurity';

/**
 * Append-only payment transaction log. Failures are swallowed so checkout is never blocked.
 */
export async function logPaymentEvent({
  storeId = '',
  orderId = '',
  eventType,
  provider = '',
  providerReference = '',
  amount = null,
  currency = 'AED',
  status = '',
  actorUserId = '',
  actorRole = '',
  ip = '',
  userAgent = '',
  meta = {},
  riskScore = null,
  riskSignals = [],
} = {}) {
  try {
    if (!eventType) return null;
    await connectDB();
    return await PaymentTransactionLog.create({
      storeId: String(storeId || ''),
      orderId: String(orderId || ''),
      eventType,
      provider: String(provider || '').toUpperCase() || '',
      providerReference: String(providerReference || '').slice(0, 200),
      amount: amount == null || Number.isNaN(Number(amount)) ? null : Number(amount),
      currency: String(currency || 'AED').toUpperCase(),
      status: String(status || '').slice(0, 80),
      actorUserId: String(actorUserId || ''),
      actorRole: String(actorRole || ''),
      ip: String(ip || '').slice(0, 80),
      userAgent: String(userAgent || '').slice(0, 400),
      meta: sanitizePaymentPayload(meta || {}),
      riskScore: riskScore == null ? null : Number(riskScore),
      riskSignals: Array.isArray(riskSignals) ? riskSignals.slice(0, 20) : [],
    });
  } catch (error) {
    console.warn('[paymentTransactionLog]', error?.message || error);
    return null;
  }
}

export async function listPaymentLogs({
  storeId = '',
  orderId = '',
  eventType = '',
  provider = '',
  limit = 50,
  skip = 0,
} = {}) {
  await connectDB();
  const filter = {};
  if (storeId) filter.storeId = String(storeId);
  if (orderId) filter.orderId = String(orderId);
  if (eventType) filter.eventType = String(eventType);
  if (provider) filter.provider = String(provider).toUpperCase();

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeSkip = Math.max(Number(skip) || 0, 0);

  const [items, total] = await Promise.all([
    PaymentTransactionLog.find(filter).sort({ createdAt: -1 }).skip(safeSkip).limit(safeLimit).lean(),
    PaymentTransactionLog.countDocuments(filter),
  ]);

  return { items, total, limit: safeLimit, skip: safeSkip };
}
