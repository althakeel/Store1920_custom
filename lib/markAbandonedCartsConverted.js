import AbandonedCart from '@/models/AbandonedCart';
import { buildProductLineSignature } from '@/lib/abandonedCartOrderMatch';
import { normalizeEmail, getPhoneVariants } from '@/lib/orderIdentity';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Mark matching abandoned carts as converted when an order completes successfully.
 * Only carts with the same products (productId + quantity) are converted.
 */
export async function markAbandonedCartsConvertedForOrder(order, { orderId } = {}) {
  if (!order?.storeId) return { modifiedCount: 0 };

  const storeId = String(order.storeId);
  const linkedOrderId = String(orderId || order._id || '').trim();
  const orderSignature = buildProductLineSignature(order.orderItems || order.items);
  if (!orderSignature) return { modifiedCount: 0 };

  const orClauses = [];

  const userId = order.userId ? String(order.userId).trim() : '';
  if (userId && userId !== 'guest') {
    orClauses.push({ userId });
  }

  const guestEmail = normalizeEmail(order.guestEmail || order.shippingAddress?.email || '');
  if (guestEmail) {
    orClauses.push({ email: guestEmail });
  }

  const phoneVariants = new Set();
  for (const candidate of [
    order.guestPhone,
    order.shippingAddress?.phone,
    order.alternatePhone,
  ]) {
    for (const variant of getPhoneVariants(candidate)) {
      phoneVariants.add(variant);
      const digits = cleanPhone(variant);
      if (digits) phoneVariants.add(digits);
    }
  }

  [...phoneVariants].forEach((phone) => {
    orClauses.push({ phone });
  });

  const anonymousId = order.trackingContext?.anonymousId
    ? String(order.trackingContext.anonymousId).trim()
    : '';
  if (anonymousId) {
    orClauses.push({ anonymousId });
  }

  if (!orClauses.length) return { modifiedCount: 0 };

  const candidateCarts = await AbandonedCart.find({
    storeId,
    status: { $in: ['active', 'pending_payment'] },
    $or: orClauses,
  })
    .select('_id items')
    .lean();

  const matchingCartIds = candidateCarts
    .filter((cart) => buildProductLineSignature(cart.items) === orderSignature)
    .map((cart) => cart._id);

  if (!matchingCartIds.length) return { modifiedCount: 0 };

  const result = await AbandonedCart.updateMany(
    { _id: { $in: matchingCartIds } },
    {
      $set: {
        status: 'converted',
        convertedAt: new Date(),
        ...(linkedOrderId ? { linkedOrderId } : {}),
      },
    },
  );

  return { modifiedCount: result.modifiedCount || 0 };
}
