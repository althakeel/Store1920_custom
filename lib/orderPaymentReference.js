import Order from '@/models/Order';
import { getDisplayOrderNumber } from '@/lib/orderDisplay';

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/** Customer-facing reference sent to Tamara, Tabby, etc. */
export function formatPaymentProviderOrderReference(order) {
  const num = getDisplayOrderNumber(order);
  if (!num) return '';
  return `ORD-${num}`;
}

function parseShortOrderNumberFromReference(reference = '') {
  const raw = String(reference || '').trim();
  if (!raw) return null;

  const prefixed = raw.match(/^(?:ORD-|ST1920-)(\d+)$/i);
  if (prefixed) return Number(prefixed[1]);

  if (/^\d+$/.test(raw)) return Number(raw);

  return null;
}

/** Resolve an order from a payment-provider reference (ORD-123456, 123456, or legacy Mongo id). */
export async function resolveOrderByPaymentReference(reference, { storeId } = {}) {
  const raw = String(reference || '').trim();
  if (!raw) return null;

  if (OBJECT_ID_RE.test(raw)) {
    const byId = await Order.findById(raw).lean();
    if (byId) return byId;
  }

  const shortOrderNumber = parseShortOrderNumberFromReference(raw);
  if (Number.isFinite(shortOrderNumber)) {
    const query = { shortOrderNumber };
    if (storeId) query.storeId = String(storeId);
    const byNumber = await Order.findOne(query).lean();
    if (byNumber) return byNumber;
  }

  return null;
}

export async function resolveOrderMongoIdFromPaymentReference(reference, options = {}) {
  const order = await resolveOrderByPaymentReference(reference, options);
  return order?._id ? String(order._id) : null;
}
