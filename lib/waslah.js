/**
 * Waslah shipping API client (UAE domestic / EMX).
 *
 * Env:
 *   WASLAH_API_BASE_URL  e.g. https://api.waslah.example/api/v1  (staging: http://localhost:9090/api/v1)
 *   WASLAH_API_TOKEN     Bearer token
 */

function getBaseUrl() {
  return String(process.env.WASLAH_API_BASE_URL || 'http://localhost:9090/api/v1').replace(/\/$/, '');
}

export function getWaslahCreateOrderPath() {
  const path = String(process.env.WASLAH_CREATE_ORDER_PATH || '/orders').trim();
  return path.startsWith('/') ? path : `/${path}`;
}

export function isWaslahConfigured() {
  return Boolean(process.env.WASLAH_API_TOKEN);
}

export function getWaslahPublicConfig() {
  return {
    configured: isWaslahConfigured(),
    baseUrl: getBaseUrl(),
    createOrderPath: getWaslahCreateOrderPath(),
    createOrderUrl: `${getBaseUrl()}${getWaslahCreateOrderPath()}`,
  };
}

export async function waslahRequest(path, { method = 'GET', body } = {}) {
  const token = process.env.WASLAH_API_TOKEN;
  if (!token) {
    throw new Error('Waslah is not configured. Set WASLAH_API_TOKEN and WASLAH_API_BASE_URL.');
  }

  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message || data?.error || JSON.stringify(data) || res.statusText;
    throw new Error(`Waslah API ${method} ${path} failed: ${message}`);
  }
  return data;
}

/** Create a Waslah shipment order. Returns the created order document. */
export async function createWaslahOrder(payload) {
  return waslahRequest(getWaslahCreateOrderPath(), { method: 'POST', body: payload });
}

/** Add order(s) to pickup cart and schedule pickup. */
export async function addOrdersToWaslahCart({ orderIds, pickupInfo }) {
  return waslahRequest('/cart', {
    method: 'POST',
    body: {
      orders: orderIds,
      pickup: true,
      pickup_info: pickupInfo,
    },
  });
}

/** Confirm pickup checkout (charges credit limit). */
export async function waslahPickupCheckout(cartId, paymentMethod = 'credit_limit') {
  return waslahRequest('/cart/pickup-checkout', {
    method: 'POST',
    body: {
      cart_id: cartId,
      payment_method: paymentMethod,
    },
  });
}

/** Print shipping label / receipt PDF. */
export async function printWaslahReceipt(orderIds, { withLabel = true } = {}) {
  return waslahRequest('/orders/print-receipt', {
    method: 'POST',
    body: {
      ids: orderIds,
      withLabel,
    },
  });
}
