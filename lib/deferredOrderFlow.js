import Order from '@/models/Order';
import Product from '@/models/Product';
import AbandonedCart from '@/models/AbandonedCart';
import { markAbandonedCartsConvertedForOrder } from '@/lib/markAbandonedCartsConverted';
import { AWAITING_PAYMENT_STATUS } from '@/lib/deferredOrderStatus';
import { buildAbandonedItemsFromOrder } from '@/lib/abandonedCartLineItems';
import { reserveOrderStockAtomically } from '@/lib/orderStockReservation';

export {
  AWAITING_PAYMENT_STATUS,
  applyDeferredPaymentOrderDefaults,
  isAwaitingPaymentOrder,
  isDeferredPaymentMethod,
  isPrepaidCapturedAtCreate,
  isVisibleStoreOrder,
  shouldDeferPaymentAtCreate,
} from '@/lib/deferredOrderStatus';

function resolveCustomerContact(order = {}) {
  const shipping = order.shippingAddress || {};
  return {
    email: String(order.guestEmail || shipping.email || '').trim().toLowerCase(),
    name: String(order.guestName || shipping.name || 'Customer').trim() || 'Customer',
    phone: String(shipping.phone || order.guestPhone || '').trim(),
    phoneCode: String(shipping.phoneCode || order.alternatePhoneCode || '+971').trim() || '+971',
    isGuest: Boolean(order.isGuest),
    userId: order.userId ? String(order.userId) : null,
    anonymousId: order.trackingContext?.anonymousId
      ? String(order.trackingContext.anonymousId).trim()
      : null,
  };
}

export async function upsertAbandonedCartForPendingOrder(order, { source = 'checkout_payment' } = {}) {
  const items = buildAbandonedItemsFromOrder(order);
  if (!items.length) return null;

  const contact = resolveCustomerContact(order);
  const now = new Date();
  const storeId = String(order.storeId);
  const linkedOrderId = String(order._id);
  const statusFilter = { $in: ['active', 'pending_payment'] };

  let existing = await AbandonedCart.findOne({
    storeId,
    linkedOrderId,
    status: statusFilter,
  }).lean();

  if (!existing && (contact.email || contact.phone || contact.userId || contact.anonymousId)) {
    const orFilters = [];
    if (contact.userId) orFilters.push({ userId: contact.userId });
    if (contact.email) orFilters.push({ email: contact.email });
    if (contact.phone) orFilters.push({ phone: contact.phone });
    if (contact.anonymousId) orFilters.push({ anonymousId: contact.anonymousId });

    if (orFilters.length) {
      existing = await AbandonedCart.findOne({
        storeId,
        status: statusFilter,
        $or: orFilters,
      }).lean();
    }
  }

  const query = existing?._id
    ? { _id: existing._id }
    : { storeId, linkedOrderId, status: statusFilter };

  return AbandonedCart.findOneAndUpdate(
    query,
    {
      $set: {
        storeId,
        userId: contact.userId,
        anonymousId: contact.anonymousId || null,
        name: contact.name,
        email: contact.email || null,
        phone: contact.phone || null,
        phoneCode: contact.phoneCode || '+971',
        address: order.shippingAddress || null,
        items,
        cartTotal: Number(order.total) || 0,
        currency: 'AED',
        lastSeenAt: now,
        source,
        status: 'pending_payment',
        linkedOrderId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

export async function decrementOrderStock(order = {}) {
  const orderId = order?._id || order?.id;
  if (!orderId) {
    throw new Error('Order id is required for atomic stock reservation');
  }
  const result = await reserveOrderStockAtomically(orderId);
  return {
    reserved: result.reserved,
    count: result.reservedProductCount,
    alreadyReserved: result.alreadyReserved,
    reservedAt: result.reservedAt,
  };
}

export async function restockOrderItems(order = {}) {
  for (const item of order.orderItems || []) {
    const productId = item?.productId?._id || item?.productId;
    const qty = Number(item?.quantity) || 0;
    if (!productId || qty <= 0) continue;

    try {
      const updated = await Product.findByIdAndUpdate(
        productId,
        { $inc: { stockQuantity: qty } },
        { new: true },
      );

      if (updated) {
        const hasStock = (typeof updated.stockQuantity === 'number' ? updated.stockQuantity : 0) > 0;
        if (updated.inStock !== hasStock) {
          await Product.findByIdAndUpdate(productId, { $set: { inStock: hasStock } });
        }
      }
    } catch (stockErr) {
      console.error('[deferred-order] restock error:', stockErr);
    }
  }
}

export async function markOrderPaymentSucceeded(orderId, { paymentStatus = 'PAID' } = {}) {
  const existing = await Order.findById(orderId).lean();
  if (!existing) return null;

  const verificationStatus = String(existing.paymentVerification?.status || '').toUpperCase();
  if (['REVERSED', 'REVOKED', 'REFUNDED', 'DISPUTED', 'CHARGEBACK', 'VOID'].includes(verificationStatus)) {
    console.warn('[deferred-order] Ignoring payment success after a terminal reversal:', orderId, verificationStatus);
    return null;
  }

  const existingPaymentStatus = String(existing.paymentStatus || '').toUpperCase();
  const alreadyPaid = existing.isPaid === true || existingPaymentStatus === 'PAID';
  const wasAwaiting = String(existing?.status || '').toUpperCase() === AWAITING_PAYMENT_STATUS;
  const transactionBackedReservation = existing.fulfillmentStockReservationRequired === true
    || wasAwaiting;
  if (alreadyPaid && (!transactionBackedReservation || existing.fulfillmentStockReservedAt)) {
    return Order.findById(orderId)
      .populate({ path: 'orderItems.productId', model: 'Product' })
      .lean();
  }

  const currentStatus = String(existing.status || '').toUpperCase();
  // Include PAYMENT_FAILED so Tabby/Tamara/Stripe/Card success can revive orders
  // that were cancelled/expired while the customer finished paying at the provider.
  const allowedStatuses = new Set([
    AWAITING_PAYMENT_STATUS,
    'ORDER_PLACED',
    'PROCESSING',
    'PAYMENT_FAILED',
  ]);
  if (existing.deletedAt || !allowedStatuses.has(currentStatus)) {
    console.warn('[deferred-order] Ignoring late payment success for inactive order:', orderId, currentStatus);
    return null;
  }

  const needsStockReservation = transactionBackedReservation
    || (
      currentStatus === 'PAYMENT_FAILED'
      && existing.fulfillmentStockReservationRequired === true
      && !existing.fulfillmentStockReservedAt
    );

  let order;
  if (needsStockReservation) {
    await reserveOrderStockAtomically(orderId, {
      paymentTransition: {
        allowedStatuses: [...allowedStatuses],
        nextStatus: 'ORDER_PLACED',
        paymentStatus,
      },
    });
    await Order.updateOne(
      { _id: orderId },
      { $unset: { cancelReason: 1, paymentRecoveryNotifiedAt: 1 } },
    );
    order = await Order.findById(orderId)
      .populate({ path: 'orderItems.productId', model: 'Product' })
      .lean();
  } else {
    // Preserve legacy orders that predate explicit reservation state. Their
    // inventory may already have been decremented by the historical checkout.
    order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        deletedAt: null,
        status: { $in: [...allowedStatuses] },
        isPaid: { $ne: true },
        paymentStatus: { $nin: ['PAID', 'paid', 'Paid'] },
      },
      {
        $set: {
          status: 'ORDER_PLACED',
          paymentStatus,
          isPaid: true,
        },
        $unset: {
          cancelReason: 1,
          paymentRecoveryNotifiedAt: 1,
        },
      },
      { new: true },
    )
      .populate({ path: 'orderItems.productId', model: 'Product' })
      .lean();
  }

  if (!order) {
    order = await Order.findById(orderId)
      .populate({ path: 'orderItems.productId', model: 'Product' })
      .lean();
    return order?.isPaid === true ? order : null;
  }

  await AbandonedCart.updateMany(
    { linkedOrderId: String(orderId), status: { $in: ['active', 'pending_payment'] } },
    {
      $set: {
        status: 'converted',
        convertedAt: new Date(),
        linkedOrderId: String(orderId),
      },
    },
  );

  await markAbandonedCartsConvertedForOrder(order, { orderId });

  return order;
}

const STALE_AWAITING_PAYMENT_MS = 60 * 60 * 1000;

/** Cancel unpaid deferred orders left open after the customer abandoned checkout. */
export async function expireStaleAwaitingPaymentOrders(storeId, { maxAgeMs = STALE_AWAITING_PAYMENT_MS } = {}) {
  if (!storeId) return { expired: 0 };

  const cutoff = new Date(Date.now() - maxAgeMs);
  const staleOrders = await Order.find({
    storeId: String(storeId),
    status: AWAITING_PAYMENT_STATUS,
    isPaid: { $ne: true },
    createdAt: { $lt: cutoff },
  })
    .select('_id')
    .lean();

  if (!staleOrders.length) return { expired: 0 };

  const { handlePaymentCancellationRecovery } = await import('@/lib/paymentCancellationRecovery');

  let expired = 0;
  for (const row of staleOrders) {
    try {
      const result = await handlePaymentCancellationRecovery({
        orderId: String(row._id),
        reason: 'Payment session expired',
      });
      if (!result?.skipped) expired += 1;
    } catch (error) {
      console.error('[deferred-order] stale payment expiry failed:', row._id, error);
    }
  }

  return { expired };
}
