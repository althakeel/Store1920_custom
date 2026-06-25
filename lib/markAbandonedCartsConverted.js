import AbandonedCart from '@/models/AbandonedCart';
import { normalizeEmail } from '@/lib/orderIdentity';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Mark matching abandoned carts as converted when an order completes successfully.
 */
export async function markAbandonedCartsConvertedForOrder(order, { orderId } = {}) {
  if (!order?.storeId) return { modifiedCount: 0 };

  const storeId = String(order.storeId);
  const linkedOrderId = String(orderId || order._id || '').trim();
  const orClauses = [];

  const userId = order.userId ? String(order.userId).trim() : '';
  if (userId && userId !== 'guest') {
    orClauses.push({ userId });
  }

  const guestEmail = normalizeEmail(order.guestEmail || order.shippingAddress?.email || '');
  if (guestEmail) {
    orClauses.push({ email: guestEmail });
  }

  const phones = [
    order.guestPhone,
    order.shippingAddress?.phone,
    order.alternatePhone,
  ]
    .map(cleanPhone)
    .filter(Boolean);

  [...new Set(phones)].forEach((phone) => {
    orClauses.push({ phone });
  });

  const anonymousId = order.trackingContext?.anonymousId
    ? String(order.trackingContext.anonymousId).trim()
    : '';
  if (anonymousId) {
    orClauses.push({ anonymousId });
  }

  if (!orClauses.length) return { modifiedCount: 0 };

  const result = await AbandonedCart.updateMany(
    {
      storeId,
      status: { $in: ['active', 'pending_payment'] },
      $or: orClauses,
    },
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
