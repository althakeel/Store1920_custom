import { normalizeEmail, getPhoneVariants } from '@/lib/orderIdentity';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function phoneSetsOverlap(left = [], right = []) {
  const normalizedLeft = [...new Set(left.map(cleanPhone).filter((p) => p.length >= 9))];
  const normalizedRight = [...new Set(right.map(cleanPhone).filter((p) => p.length >= 9))];

  return normalizedLeft.some((leftPhone) =>
    normalizedRight.some((rightPhone) =>
      leftPhone === rightPhone
      || leftPhone.endsWith(rightPhone)
      || rightPhone.endsWith(leftPhone),
    ),
  );
}

export function buildProductLineSignature(items = []) {
  const lines = (Array.isArray(items) ? items : [])
    .map((item) => {
      const productId = String(item?.productId?._id || item?.productId || '').trim();
      const qty = Math.max(1, Number(item?.quantity) || 1);
      return productId ? `${productId}:${qty}` : null;
    })
    .filter(Boolean)
    .sort();

  return lines.join('|');
}

export function extractCartContact(cart = {}) {
  const email = normalizeEmail(cart.email || cart.address?.email || '');
  const phones = new Set();

  for (const variant of getPhoneVariants(cart.phone, cart.phoneCode)) {
    phones.add(variant);
  }

  if (cart.address?.phone) {
    for (const variant of getPhoneVariants(cart.address.phone, cart.phoneCode)) {
      phones.add(variant);
    }
  }

  const userId = cart.userId ? String(cart.userId).trim() : '';

  return {
    email,
    phones: [...phones].filter(Boolean),
    userId: userId && userId !== 'guest' ? userId : '',
  };
}

export function extractOrderContact(order = {}) {
  const email = normalizeEmail(order.guestEmail || order.shippingAddress?.email || '');
  const phones = new Set();

  for (const candidate of [
    order.guestPhone,
    order.shippingAddress?.phone,
    order.alternatePhone,
  ]) {
    for (const variant of getPhoneVariants(candidate)) {
      phones.add(variant);
    }
  }

  const userId = order.userId ? String(order.userId).trim() : '';

  return {
    email,
    phones: [...phones].filter(Boolean),
    userId: userId && userId !== 'guest' ? userId : '',
  };
}

export function contactsMatch(cartContact, orderContact) {
  if (cartContact.userId && orderContact.userId && cartContact.userId === orderContact.userId) {
    return true;
  }

  const cartHasEmail = Boolean(cartContact.email);
  const cartHasPhone = cartContact.phones.length > 0;
  const orderHasEmail = Boolean(orderContact.email);
  const orderHasPhone = orderContact.phones.length > 0;

  const emailMatch = cartHasEmail && orderHasEmail && cartContact.email === orderContact.email;
  const phoneMatch = cartHasPhone && orderHasPhone && phoneSetsOverlap(cartContact.phones, orderContact.phones);

  if (cartHasEmail && cartHasPhone && orderHasEmail && orderHasPhone) {
    return emailMatch && phoneMatch;
  }

  return emailMatch || phoneMatch;
}

export function isSuccessfulPlacedOrder(order) {
  const status = String(order?.status || '').toUpperCase();
  if (['PAYMENT_FAILED', 'CANCELLED', 'AWAITING_PAYMENT'].includes(status)) {
    return false;
  }

  if (order?.isPaid === true) return true;
  if (String(order?.paymentStatus || '').toUpperCase() === 'PAID') return true;

  const method = String(order?.paymentMethod || '').toUpperCase();
  if (method === 'COD' && status === 'ORDER_PLACED') return true;

  return false;
}

export function cartMatchesPlacedOrder(cart, order) {
  if (!isSuccessfulPlacedOrder(order)) return false;
  if (String(order.storeId) !== String(cart.storeId)) return false;

  const cartSignature = buildProductLineSignature(cart.items);
  const orderSignature = buildProductLineSignature(order.orderItems || order.items);
  if (!cartSignature || !orderSignature || cartSignature !== orderSignature) {
    return false;
  }

  return contactsMatch(extractCartContact(cart), extractOrderContact(order));
}

export function findMatchingPlacedOrderForCart(cart, orders = []) {
  return orders.find((order) => cartMatchesPlacedOrder(cart, order)) || null;
}

const DEFAULT_ORDER_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

export async function autoConvertAbandonedCartsWithPlacedOrders(carts = [], orders = [], AbandonedCartModel) {
  const conversions = [];

  for (const cart of carts) {
    if (!['active', 'pending_payment'].includes(String(cart.status || 'active'))) continue;

    const matchedOrder = findMatchingPlacedOrderForCart(cart, orders);
    if (!matchedOrder) continue;

    conversions.push({
      cartId: String(cart._id),
      orderId: String(matchedOrder._id),
    });
  }

  if (!conversions.length || !AbandonedCartModel) {
    return { convertedCount: 0, convertedCartIds: [] };
  }

  const convertedAt = new Date();
  await Promise.all(conversions.map(({ cartId, orderId }) =>
    AbandonedCartModel.updateOne(
      { _id: cartId, status: { $in: ['active', 'pending_payment'] } },
      {
        $set: {
          status: 'converted',
          convertedAt,
          linkedOrderId: orderId,
        },
      },
    ),
  ));

  const convertedCartIds = new Set(conversions.map((entry) => entry.cartId));

  return {
    convertedCount: conversions.length,
    convertedCartIds: [...convertedCartIds],
  };
}

export function getPlacedOrderLookbackDate(maxAgeMs = DEFAULT_ORDER_LOOKBACK_MS) {
  return new Date(Date.now() - maxAgeMs);
}
