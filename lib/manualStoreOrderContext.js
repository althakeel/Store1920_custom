import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

const trustedManualStoreOrderStorage = new AsyncLocalStorage();
const TRUSTED_SOURCES = new Set([
  'store_order_create',
  'abandoned_cart_recovery',
]);

export function runWithTrustedManualStoreOrder(context = {}, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('Trusted manual store order callback is required');
  }

  const source = String(context.source || '').trim();
  const storeId = String(context.storeId || '').trim();
  const actorId = String(context.actorId || '').trim();
  if (!TRUSTED_SOURCES.has(source) || !storeId || !actorId) {
    throw new TypeError('Complete trusted manual store order context is required');
  }

  return trustedManualStoreOrderStorage.run(
    Object.freeze({ source, storeId, actorId }),
    callback,
  );
}

export function getTrustedManualStoreOrder() {
  return trustedManualStoreOrderStorage.getStore() || null;
}
