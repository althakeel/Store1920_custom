import Order from '@/models/Order';
import Product from '@/models/Product';
import AbandonedCart from '@/models/AbandonedCart';
import { markAbandonedCartsConvertedForOrder } from '@/lib/markAbandonedCartsConverted';
import { AWAITING_PAYMENT_STATUS } from '@/lib/deferredOrderStatus';
import {
  buildVariantStockDecrementQuery,
  matchVariantByOptions,
} from '@/lib/productVariantOptions';

export {
  AWAITING_PAYMENT_STATUS,
  applyDeferredPaymentOrderDefaults,
  isAwaitingPaymentOrder,
  isDeferredPaymentMethod,
  isVisibleStoreOrder,
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

function buildAbandonedItems(order = {}) {
  return (order.orderItems || []).map((item) => {
    const product = item?.productId && typeof item.productId === 'object' ? item.productId : null;
    return {
      productId: product?._id || item.productId,
      name: product?.name || item.name || 'Product',
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || Number(product?.price) || 0,
    };
  }).filter((item) => item.productId);
}

export async function upsertAbandonedCartForPendingOrder(order, { source = 'checkout_payment' } = {}) {
  const items = buildAbandonedItems(order);
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
  const stockUpdates = (order.orderItems || [])
    .map((item) => ({
      id: item?.productId?._id || item?.productId,
      qty: Number(item?.quantity) || 0,
      variantOptions: item?.variantOptions,
    }))
    .filter((item) => item.qty > 0 && item.id);

  if (!stockUpdates.length) return;

  await Product.bulkWrite(
    stockUpdates.map(({ id, qty }) => ({
      updateOne: {
        filter: { _id: id },
        update: [
          {
            $set: {
              stockQuantity: {
                $max: [0, { $subtract: [{ $ifNull: ['$stockQuantity', 0] }, qty] }],
              },
            },
          },
          {
            $set: {
              inStock: { $gt: ['$stockQuantity', 0] },
            },
          },
        ],
      },
    })),
    { ordered: false },
  );

  await Promise.all(
    stockUpdates.map(async ({ id, qty, variantOptions }) => {
      if (!variantOptions) return null;
      const product = await Product.findById(id).select('variants').lean();
      const matchedVariant = product?.variants?.length
        ? matchVariantByOptions(product.variants, variantOptions)
        : null;
      if (!matchedVariant) return null;
      return Product.updateOne(
        buildVariantStockDecrementQuery(id, matchedVariant),
        { $inc: { 'variants.$.stock': -qty } },
      );
    }),
  );
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
  const wasAwaiting = String(existing?.status || '').toUpperCase() === AWAITING_PAYMENT_STATUS;

  const order = await Order.findByIdAndUpdate(
    orderId,
    {
      $set: {
        status: 'ORDER_PLACED',
        paymentStatus,
        isPaid: true,
      },
    },
    { new: true },
  )
    .populate({ path: 'orderItems.productId', model: 'Product' })
    .lean();

  if (!order) return null;

  if (wasAwaiting) {
    await decrementOrderStock(order);
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
