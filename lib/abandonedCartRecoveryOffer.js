import crypto from 'crypto';
import { getAbandonedCartTotal } from '@/lib/abandonedCartUtils';

export function generateRecoveryToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function computeRecoveryOfferTotal(cartTotalMax, pricingMode, discountInput, customPrice) {
  const total = Number(cartTotalMax || 0);
  if (!Number.isFinite(total) || total <= 0) {
    return { final: null, error: 'Invalid cart total' };
  }

  if (pricingMode === 'none') {
    return { final: total, error: '' };
  }

  if (pricingMode === 'amount') {
    if (discountInput === '') return { final: null, error: 'Enter discount amount' };
    const discount = Number(discountInput);
    if (!Number.isFinite(discount) || discount < 0) return { final: null, error: 'Enter a valid discount amount' };
    if (discount > total) return { final: null, error: 'Discount cannot exceed cart total' };
    return { final: Number((total - discount).toFixed(2)), error: '' };
  }

  if (pricingMode === 'percent') {
    if (discountInput === '') return { final: null, error: 'Enter discount percentage' };
    const percent = Number(discountInput);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return { final: null, error: 'Enter a percentage between 0 and 100' };
    }
    return { final: Number((total * (1 - percent / 100)).toFixed(2)), error: '' };
  }

  if (customPrice === '') return { final: null, error: 'Enter the final order value' };
  const parsed = Number(customPrice);
  if (!Number.isFinite(parsed) || parsed < 0) return { final: null, error: 'Enter a valid amount' };
  if (parsed > total) return { final: null, error: 'Final amount cannot exceed cart total' };
  return { final: parsed, error: '' };
}

export function buildRecoveryLink(origin, token) {
  const base = String(origin || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  return `${base}/recover-cart/${token}`;
}

export function applyRecoveryPricingToItems(items = [], offerTotal, cartTotalMax) {
  if (!Array.isArray(items) || !items.length) return [];
  const safeOffer = Number(offerTotal);
  const safeMax = Number(cartTotalMax);
  if (!Number.isFinite(safeOffer) || !Number.isFinite(safeMax) || safeMax <= 0) {
    return items.map((item) => ({ ...item, originalPrice: Number(item.price || 0) }));
  }

  const ratio = safeOffer / safeMax;
  return items.map((item) => {
    const originalPrice = Number(item.price || 0);
    return {
      ...item,
      originalPrice,
      price: Number((originalPrice * ratio).toFixed(2)),
    };
  });
}

function normalizeCartLine(item = {}) {
  return {
    productId: String(item.productId || item.id || '').trim(),
    quantity: Math.max(1, Number(item.quantity || 1)),
  };
}

export function cartItemsMatchAbandoned(orderItems = [], abandonedItems = []) {
  const expected = abandonedItems.map(normalizeCartLine).filter((line) => line.productId);
  const actual = orderItems.map(normalizeCartLine).filter((line) => line.productId);

  if (expected.length !== actual.length) return false;

  const sortKey = (line) => `${line.productId}:${line.quantity}`;
  const expectedSorted = [...expected].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const actualSorted = [...actual].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  return expectedSorted.every((line, index) => (
    line.productId === actualSorted[index].productId
    && line.quantity === actualSorted[index].quantity
  ));
}

function resolveRecoveryCartTotal(cart = {}) {
  const stored = Number(cart.recoveryCartTotal);
  if (Number.isFinite(stored) && stored > 0) return stored;

  const snapshot = Number(cart.cartTotal);
  if (Number.isFinite(snapshot) && snapshot > 0) return snapshot;

  return getAbandonedCartTotal(cart);
}

export async function findActiveRecoveryCart(AbandonedCart, token) {
  const recoveryToken = String(token || '').trim();
  if (!recoveryToken) {
    return { valid: false, error: 'Recovery token is required' };
  }

  const cart = await AbandonedCart.findOne({ recoveryToken }).lean();

  if (!cart) {
    return { valid: false, error: 'This recovery link is invalid or has already been used' };
  }

  if (cart.status === 'converted') {
    return { valid: false, error: 'This recovery link has already been used' };
  }

  if (cart.recoveryLinkExpiresAt && new Date(cart.recoveryLinkExpiresAt) < new Date()) {
    return { valid: false, error: 'This recovery link has expired' };
  }

  const cartTotal = resolveRecoveryCartTotal(cart);
  const offerTotal = Number(cart.recoveryOfferTotal);

  if (!Number.isFinite(offerTotal) || offerTotal <= 0) {
    return { valid: false, error: 'This recovery offer is no longer valid. Ask the store to send a new link.' };
  }

  if (cartTotal > 0 && offerTotal > cartTotal + 0.01) {
    return { valid: false, error: 'This recovery offer is no longer valid. Ask the store to send a new link.' };
  }

  const pricingBase = cartTotal > 0 ? cartTotal : offerTotal;

  return {
    valid: true,
    cart,
    cartTotal: pricingBase,
    offerTotal,
    discountedItems: applyRecoveryPricingToItems(cart.items || [], offerTotal, pricingBase),
  };
}
