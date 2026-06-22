import { getConversionPaymentMethodLabel } from '@/lib/abandonedCartRecoveryPayment';

const TERMINAL_STATUSES = new Set(['DELIVERED', 'RETURNED', 'CANCELLED']);

export function isTerminalDeliveryStatus(status) {
  return TERMINAL_STATUSES.has(String(status || '').toUpperCase());
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function getOrderExpectedDeliveryDate(order) {
  const raw = order?.delhivery?.expected_delivery_date;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getDeliveryBucket(order, referenceDate = new Date()) {
  if (isTerminalDeliveryStatus(order?.status)) return null;

  const expected = getOrderExpectedDeliveryDate(order);
  if (!expected) return null;

  const today = startOfDay(referenceDate);
  const tomorrow = startOfDay(referenceDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const expectedDay = startOfDay(expected);

  if (expectedDay < today) return 'delayed';
  if (expectedDay.getTime() === today.getTime()) return 'today';
  if (expectedDay.getTime() === tomorrow.getTime()) return 'tomorrow';
  return null;
}

function getOrderCustomerKey(order) {
  if (order?.userId && typeof order.userId === 'object' && order.userId._id) {
    return `user:${order.userId._id}`;
  }
  if (order?.userId && typeof order.userId === 'string') {
    return `user:${order.userId}`;
  }

  const email = String(order?.guestEmail || order?.shippingAddress?.email || '').trim().toLowerCase();
  if (email) return `email:${email}`;

  const phone = String(order?.guestPhone || order?.shippingAddress?.phone || order?.alternatePhone || '').trim();
  if (phone) return `phone:${phone}`;

  return null;
}

function getCartCustomerKey(cart) {
  if (cart?.userId) return `user:${cart.userId}`;
  const email = String(cart?.email || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = String(cart?.phone || '').trim();
  if (phone) return `phone:${phone}`;
  return null;
}

function totalsAreClose(left, right) {
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= Math.max(5, a * 0.05);
}

function cartMatchesOrder(cart, order) {
  if (cart?.linkedOrderId && String(cart.linkedOrderId) === String(order._id)) {
    return true;
  }

  const cartKey = getCartCustomerKey(cart);
  const orderKey = getOrderCustomerKey(order);
  if (!cartKey || !orderKey || cartKey !== orderKey) return false;

  const convertedAt = cart?.convertedAt ? new Date(cart.convertedAt) : null;
  const orderAt = order?.createdAt ? new Date(order.createdAt) : null;
  if (!convertedAt || !orderAt || Number.isNaN(convertedAt.getTime()) || Number.isNaN(orderAt.getTime())) {
    return false;
  }

  const diffMs = orderAt.getTime() - convertedAt.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  if (diffMs < -oneDay || diffMs > 14 * oneDay) return false;

  const cartTotal = cart?.convertedCartTotal ?? cart?.cartTotal;
  return totalsAreClose(cartTotal, order?.total);
}

export function buildConversionMeta(cart) {
  if (!cart || cart.status !== 'converted') return null;

  return {
    cartId: String(cart._id),
    convertedByName: cart.convertedByName || null,
    convertedBy: cart.convertedBy || null,
    convertedAt: cart.convertedAt || null,
    note: cart.conversionNote || null,
    discountType: cart.conversionDiscountType || 'none',
    discountValue: cart.conversionDiscountValue,
    paymentMethod: cart.conversionPaymentMethod || null,
    finalTotal: cart.convertedCartTotal ?? null,
    originalTotal: cart.cartTotal ?? null,
  };
}

export function matchConvertedCartsToOrders(orders, convertedCarts) {
  const conversionByOrderId = new Map();
  const usedCartIds = new Set();

  for (const order of orders) {
    const candidates = (convertedCarts || [])
      .filter((cart) => cart?.status === 'converted' && !usedCartIds.has(String(cart._id)))
      .filter((cart) => cartMatchesOrder(cart, order))
      .sort((a, b) => {
        const aTime = new Date(a.convertedAt || 0).getTime();
        const bTime = new Date(b.convertedAt || 0).getTime();
        const orderTime = new Date(order.createdAt || 0).getTime();
        return Math.abs(orderTime - aTime) - Math.abs(orderTime - bTime);
      });

    const bestMatch = candidates[0];
    if (!bestMatch) continue;

    usedCartIds.add(String(bestMatch._id));
    conversionByOrderId.set(String(order._id), buildConversionMeta(bestMatch));
  }

  return conversionByOrderId;
}

export function attachConversionToOrders(orders, convertedCarts) {
  const conversionByOrderId = matchConvertedCartsToOrders(orders, convertedCarts);
  return orders.map((order) => {
    const conversion = conversionByOrderId.get(String(order._id)) || null;
    return conversion ? { ...order, conversion } : order;
  });
}

export function formatConversionDiscount(conversion, currency = 'AED') {
  if (!conversion) return null;
  const { discountType, discountValue } = conversion;
  if (discountType === 'amount' && discountValue != null) {
    return `${currency} ${Number(discountValue).toFixed(2)} off`;
  }
  if (discountType === 'percent' && discountValue != null) {
    return `${discountValue}% off`;
  }
  if (discountType === 'custom') {
    return 'Custom pricing';
  }
  return null;
}

export function getOrderDiscountLines(order, currency = 'AED') {
  const lines = [];

  if (order?.isCouponUsed && order?.coupon) {
    const code = order.coupon.code || 'Coupon';
    const discount = order.coupon.discount;
    lines.push({
      label: 'Coupon',
      detail: discount != null ? `${code} (${discount}% off)` : code,
    });
  }

  if (Number(order?.walletDiscount) > 0) {
    lines.push({
      label: 'Wallet',
      detail: `${currency} ${Number(order.walletDiscount).toFixed(2)}`,
    });
  }

  if (Number(order?.coinsRedeemed) > 0) {
    lines.push({
      label: 'Coins redeemed',
      detail: `${order.coinsRedeemed} coins`,
    });
  }

  if (order?.conversion) {
    const conversionDiscount = formatConversionDiscount(order.conversion, currency);
    if (conversionDiscount) {
      lines.push({
        label: 'Recovery discount',
        detail: conversionDiscount,
      });
    }
  }

  return lines;
}

export function getConversionPaymentLabel(conversion) {
  if (!conversion?.paymentMethod) return null;
  return getConversionPaymentMethodLabel(conversion.paymentMethod);
}

export function summarizeDeliveryBuckets(orders, referenceDate = new Date()) {
  const summary = { today: 0, tomorrow: 0, delayed: 0 };
  for (const order of orders) {
    const bucket = getDeliveryBucket(order, referenceDate);
    if (bucket) summary[bucket] += 1;
  }
  return summary;
}
