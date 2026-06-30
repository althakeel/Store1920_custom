import { isConfirmedPaidOrder } from '@/lib/orderConfirmationPolicy';
import { isPrepaidCapturedAtCreate } from '@/lib/deferredOrderStatus';

/**
 * Meta Purchase should fire exactly once per order.
 * - COD / prepaid card / wallet: browser on order-success only
 * - Stripe / Tabby / Tamara: server CAPI on payment webhook (browser skipped if already sent)
 */

export function shouldSendServerMetaPurchaseOnCreate(order = {}, paymentMethod = '') {
  const method = String(paymentMethod || order.paymentMethod || '').toUpperCase();
  if (method === 'COD') return false;
  if (method === 'WALLET') return false;
  if (isPrepaidCapturedAtCreate(method, order)) return false;
  return false;
}

export function shouldSendBrowserMetaPurchase(order = {}) {
  if (!isConfirmedPaidOrder(order)) return false;
  if (order.metaPurchaseSentAt) return false;
  return true;
}
