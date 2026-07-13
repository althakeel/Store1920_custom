import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

const verifiedRazorpayOrderStorage = new AsyncLocalStorage();

function normalizeVerification(verification = {}) {
  return Object.freeze({
    paymentId: String(verification.paymentId || ''),
    orderId: String(verification.orderId || ''),
    signature: String(verification.signature || ''),
  });
}

export function runWithVerifiedRazorpayOrder(verification, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('Verified Razorpay order callback is required');
  }

  const context = normalizeVerification(verification);
  if (!context.paymentId || !context.orderId || !context.signature) {
    throw new TypeError('Complete verified Razorpay payment details are required');
  }

  return verifiedRazorpayOrderStorage.run(context, callback);
}

export function getVerifiedRazorpayOrder() {
  return verifiedRazorpayOrderStorage.getStore() || null;
}
