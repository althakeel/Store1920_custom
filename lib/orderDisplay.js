/** MongoDB order id for API routes and deep links. */
import { buildCustomerSitePath } from '@/lib/appUrl';

export function getOrderMongoId(order) {
  const id = order?._id ?? order?.id;
  return id != null ? String(id) : '';
}

/** Populated product on an order line (API uses productId). */
export function getOrderLineProduct(item) {
  if (!item) return {};
  if (item.product && typeof item.product === 'object') return item.product;
  if (item.productId && typeof item.productId === 'object') return item.productId;
  return {};
}

/** Customer-facing order number (e.g. 523304). Never returns MongoDB _id. */
export function getDisplayOrderNumber(order) {
  const short = order?.shortOrderNumber;
  if (short != null && String(short).trim() !== '') {
    return String(short);
  }
  return '';
}

export function getDisplayOrderLabel(order) {
  const num = getDisplayOrderNumber(order);
  return num ? `Order No: ${num}` : 'Order No: Pending';
}

/** Track-order page URL with order number prefilled and auto-track enabled. */
export function buildTrackOrderPageUrl(orderOrData = {}) {
  const base = buildCustomerSitePath('/track-order');
  const orderNo = getDisplayOrderNumber(orderOrData);
  if (!orderNo) return base;

  const qs = new URLSearchParams({ orderNo, auto: '1' });
  const shipping = orderOrData.shippingAddress || {};
  const phone = String(shipping.phone || orderOrData.phone || '').trim();

  if (phone) {
    const code = String(shipping.phoneCode || orderOrData.phoneCode || '+971').trim();
    qs.set('phone', `${code}${phone}`.replace(/\s/g, ''));
  }

  return `${base}?${qs.toString()}`;
}

/** Best available customer label for store dashboard / exports. */
export function getOrderCustomerDisplayName(order = {}) {
  const shipping = order.shippingAddress || {};
  const user = order.userId && typeof order.userId === 'object' ? order.userId : null;
  const userName = String(user?.name || '').trim();
  const userEmail = String(user?.email || '').trim();

  const candidates = [
    order.isGuest ? order.guestName : null,
    shipping.name,
    userName && userName !== 'Unknown' ? userName : null,
    order.guestName,
    userEmail,
    order.guestEmail,
    shipping.email,
    order.guestPhone,
    shipping.phone,
  ];

  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) return text;
  }

  return order.isGuest ? 'Guest customer' : 'Customer';
}

/** Store dashboard: original order date + time (UAE). */
export function formatStoreOrderDateTime(value, { timeZone = 'Asia/Dubai' } = {}) {
  const { date, time } = formatStoreOrderDateParts(value, { timeZone });
  if (date === '—') return '—';
  return time ? `${date}, ${time}` : date;
}

/** Split date and time for table cells (date on one line, time below). */
export function formatStoreOrderDateParts(value, { timeZone = 'Asia/Dubai' } = {}) {
  if (!value) return { date: '—', time: '' };
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '—', time: '' };
  return {
    date: date.toLocaleDateString('en-GB', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  };
}
