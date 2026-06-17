export const STORE_ORDER_NOTIFICATION_EVENT = 'store-new-order';
export const STORE_ORDER_CHECKPOINT_PREFIX = 'store1920:order-notification-checkpoint';
export const STORE_ORDER_NOTIFIED_PREFIX = 'store1920:order-notification-seen';

export function getOrderNotificationCheckpoint(storeId) {
  if (typeof window === 'undefined' || !storeId) return new Date().toISOString();

  try {
    const saved = sessionStorage.getItem(`${STORE_ORDER_CHECKPOINT_PREFIX}:${storeId}`);
    if (saved) return saved;
  } catch {
    // Ignore storage failures.
  }

  const now = new Date().toISOString();
  setOrderNotificationCheckpoint(storeId, now);
  return now;
}

export function setOrderNotificationCheckpoint(storeId, isoString = new Date().toISOString()) {
  if (typeof window === 'undefined' || !storeId) return;

  try {
    sessionStorage.setItem(`${STORE_ORDER_CHECKPOINT_PREFIX}:${storeId}`, isoString);
  } catch {
    // Ignore storage failures.
  }
}

export function getNotifiedOrderIds(storeId) {
  if (typeof window === 'undefined' || !storeId) return new Set();

  try {
    const raw = sessionStorage.getItem(`${STORE_ORDER_NOTIFIED_PREFIX}:${storeId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function rememberNotifiedOrderIds(storeId, orderIds = []) {
  if (typeof window === 'undefined' || !storeId || !orderIds.length) return;

  try {
    const current = getNotifiedOrderIds(storeId);
    orderIds.forEach((id) => current.add(String(id)));
    const trimmed = [...current].slice(-200);
    sessionStorage.setItem(`${STORE_ORDER_NOTIFIED_PREFIX}:${storeId}`, JSON.stringify(trimmed));
  } catch {
    // Ignore storage failures.
  }
}

export function dispatchStoreNewOrderEvent(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STORE_ORDER_NOTIFICATION_EVENT, { detail }));
}
