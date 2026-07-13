import Order from '@/models/Order';
import { findOrderByTrackingIdentifier } from '@/lib/orderTrackingLookup';
import { ACTIVE_RECORD_FILTER } from '@/lib/storeTrash';
import { appendOrderCommunicationLog } from '@/lib/orderCommunicationLog';
import { sendOrderStatusEmail } from '@/lib/email';

export const WAREHOUSE_PACKED_STATUS = 'WAITING_FOR_PICKUP';

const BLOCKED_PACK_STATUSES = new Set([
  'CANCELLED',
  'DELIVERED',
  'RETURNED',
  'RETURN',
  'RTO',
  'RETURN_INITIATED',
  'RETURN_APPROVED',
  'RETURN_REQUESTED',
]);

export function isOrderWarehousePacked(order = {}) {
  return order?.warehousePacking?.packed === true;
}

export function formatWarehousePacking(order = {}) {
  const packing = order?.warehousePacking || {};
  if (!packing.packed) {
    return {
      packed: false,
      packedAt: null,
      packedByUid: null,
      packedByName: null,
      packedByEmail: null,
      previousStatus: null,
      notes: null,
      emailSentAt: null,
    };
  }
  return {
    packed: true,
    packedAt: packing.packedAt || null,
    packedByUid: packing.packedByUid || null,
    packedByName: packing.packedByName || null,
    packedByEmail: packing.packedByEmail || null,
    previousStatus: packing.previousStatus || null,
    notes: packing.notes || null,
    emailSentAt: packing.emailSentAt || null,
  };
}

function serializePackedOrder(order) {
  if (!order) return null;
  const plain = typeof order.toObject === 'function' ? order.toObject() : order;
  return {
    ...plain,
    warehousePacking: formatWarehousePacking(plain),
  };
}

async function resolvePackTargetOrder({ storeId, orderId, q }) {
  const id = String(orderId || '').trim();
  const query = String(q || '').trim();

  if (id) {
    const byId = await Order.findOne({
      _id: id,
      storeId: String(storeId),
      ...ACTIVE_RECORD_FILTER,
    })
      .populate({ path: 'userId', select: 'email name' })
      .exec();
    if (byId) return byId;
  }

  if (query) {
    const found = await findOrderByTrackingIdentifier(query);
    if (
      found
      && !found.deletedAt
      && String(found.storeId) === String(storeId)
    ) {
      return Order.findById(found._id)
        .populate({ path: 'userId', select: 'email name' })
        .exec();
    }
  }

  return null;
}

/**
 * Mark an order packed for warehouse / Packed button.
 * Sets status to WAITING_FOR_PICKUP ("Awaiting Pickup") and emails the customer.
 */
export async function packStoreOrder({
  storeId,
  orderId = '',
  q = '',
  notes = '',
  actor = {},
  force = false,
} = {}) {
  if (!storeId) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const order = await resolvePackTargetOrder({ storeId, orderId, q });
  if (!order) {
    return { ok: false, status: 404, error: 'Order not found' };
  }

  if (isOrderWarehousePacked(order) && !force) {
    return {
      ok: true,
      alreadyPacked: true,
      statusChanged: false,
      emailSent: false,
      order: serializePackedOrder(order),
      warehousePacking: formatWarehousePacking(order),
      message: 'Order is already packed',
    };
  }

  const previousStatus = String(order.status || '').toUpperCase();
  if (BLOCKED_PACK_STATUSES.has(previousStatus)) {
    return {
      ok: false,
      status: 400,
      error: `Cannot pack an order with status ${previousStatus}`,
      order: serializePackedOrder(order),
    };
  }

  const packedAt = new Date();
  const packedByUid = String(actor.uid || actor.userId || '').trim() || null;
  const packedByName = String(actor.name || actor.email || 'Warehouse staff').trim();
  const packedByEmail = String(actor.email || '').trim() || null;
  const noteText = String(notes || '').trim() || null;

  order.warehousePacking = {
    ...(order.warehousePacking?.toObject?.() || order.warehousePacking || {}),
    packed: true,
    packedAt,
    packedByUid,
    packedByName,
    packedByEmail,
    previousStatus: previousStatus || null,
    notes: noteText,
    emailSentAt: order.warehousePacking?.emailSentAt || null,
  };

  const statusChanged = previousStatus !== WAREHOUSE_PACKED_STATUS;
  if (statusChanged) {
    order.status = WAREHOUSE_PACKED_STATUS;
  }

  await order.save();

  let emailSent = false;
  let emailError = null;
  const recipient = order.guestEmail
    || order.shippingAddress?.email
    || order.userId?.email
    || '';

  // Email on first pack (or force) when status is/moves to awaiting pickup
  const shouldEmail = statusChanged || !order.warehousePacking?.emailSentAt || force;
  if (shouldEmail) {
    try {
      await sendOrderStatusEmail(order, WAREHOUSE_PACKED_STATUS);
      emailSent = true;
      order.warehousePacking.emailSentAt = new Date();
      await order.save();
      await appendOrderCommunicationLog(order._id, {
        channel: 'email',
        template: 'status_WAITING_FOR_PICKUP',
        label: 'Packed — awaiting pickup email',
        status: 'sent',
        recipient,
        sentByUid: packedByUid,
        sentByName: packedByName,
        details: 'Order marked packed in warehouse',
      });
    } catch (err) {
      emailError = err?.message || 'Email failed';
      await appendOrderCommunicationLog(order._id, {
        channel: 'email',
        template: 'status_WAITING_FOR_PICKUP',
        label: 'Packed — awaiting pickup email',
        status: 'failed',
        recipient,
        sentByUid: packedByUid,
        sentByName: packedByName,
        details: emailError,
      }).catch(() => {});
    }
  }

  return {
    ok: true,
    alreadyPacked: false,
    statusChanged,
    previousStatus,
    status: order.status,
    emailSent,
    emailError,
    order: serializePackedOrder(order),
    warehousePacking: formatWarehousePacking(order),
    message: statusChanged
      ? 'Order packed and set to Awaiting Pickup'
      : 'Order packed',
  };
}

export async function listPackedStoreOrders({
  storeId,
  page = 1,
  limit = 25,
  fromDate = '',
  toDate = '',
} = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 25));
  const filter = {
    storeId: String(storeId),
    ...ACTIVE_RECORD_FILTER,
    'warehousePacking.packed': true,
  };

  const packedAtFilter = {};
  if (fromDate) {
    const from = new Date(fromDate);
    if (!Number.isNaN(from.getTime())) packedAtFilter.$gte = from;
  }
  if (toDate) {
    const to = new Date(toDate);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      packedAtFilter.$lte = to;
    }
  }
  if (Object.keys(packedAtFilter).length) {
    filter['warehousePacking.packedAt'] = packedAtFilter;
  }

  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .sort({ 'warehousePacking.packedAt': -1, createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .select('_id shortOrderNumber status total paymentMethod paymentStatus createdAt updatedAt guestName guestEmail guestPhone shippingAddress trackingId courier waslah warehousePacking orderItems')
      .lean(),
  ]);

  return {
    page: pageNum,
    limit: pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    orders: orders.map((order) => ({
      ...order,
      warehousePacking: formatWarehousePacking(order),
    })),
  };
}
