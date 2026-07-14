import Order from '@/models/Order';
import { allocateShortOrderNumber } from '@/lib/orderNumber';

/** Allocate and persist a real short order number when missing (legacy orders). */
export async function ensurePersistedShortOrderNumber(order) {
  if (!order) return order;
  if (order.shortOrderNumber) return order;

  const orderId = order._id?.toString?.() || order._id;
  const storeId = order.storeId;
  if (!orderId || !storeId) return order;

  const existing = await Order.findById(orderId).select('shortOrderNumber').lean();
  if (existing?.shortOrderNumber) {
    return { ...order, shortOrderNumber: existing.shortOrderNumber };
  }

  const shortOrderNumber = await allocateShortOrderNumber(storeId);
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, $or: [{ shortOrderNumber: null }, { shortOrderNumber: { $exists: false } }] },
    { $set: { shortOrderNumber } },
    { new: true },
  )
    .select('shortOrderNumber')
    .lean();

  if (updated?.shortOrderNumber) {
    return { ...order, shortOrderNumber: updated.shortOrderNumber };
  }

  // Another writer won the race — use the persisted number, never the wasted allocation.
  const latest = await Order.findById(orderId).select('shortOrderNumber').lean();
  return {
    ...order,
    shortOrderNumber: latest?.shortOrderNumber || shortOrderNumber,
  };
}

export async function ensurePersistedShortOrderNumbers(orders) {
  if (!Array.isArray(orders)) return orders;
  return Promise.all(orders.map((order) => ensurePersistedShortOrderNumber(order)));
}
