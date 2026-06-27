import { getAbandonedCartTotal } from '@/lib/abandonedCartUtils';

const DEFAULT_CHECKOUT_DISCOUNT_PERCENT = Number(
  process.env.WABA_ABANDONED_CHECKOUT_DISCOUNT_PERCENT || 5,
);

export function resolveAbandonedCheckoutOfferTotal(cart = {}, cartTotal = null) {
  const original = Number(
    cartTotal ?? cart.recoveryCartTotal ?? cart.cartTotal ?? getAbandonedCartTotal(cart),
  );
  if (!Number.isFinite(original) || original <= 0) {
    return { original: 0, discounted: 0 };
  }

  const storedOffer = Number(cart.recoveryOfferTotal);
  if (Number.isFinite(storedOffer) && storedOffer > 0 && storedOffer < original - 0.001) {
    return { original, discounted: storedOffer };
  }

  const type = String(cart.recoveryDiscountType || '').trim();
  const value = Number(cart.recoveryDiscountValue);

  if (type === 'percent' && Number.isFinite(value) && value > 0 && value < 100) {
    return {
      original,
      discounted: Number((original * (1 - value / 100)).toFixed(2)),
    };
  }

  if (type === 'amount' && Number.isFinite(value) && value > 0) {
    return {
      original,
      discounted: Number(Math.max(0, original - value).toFixed(2)),
    };
  }

  if (type === 'custom' && Number.isFinite(storedOffer) && storedOffer > 0) {
    return { original, discounted: Math.min(storedOffer, original) };
  }

  const percent = DEFAULT_CHECKOUT_DISCOUNT_PERCENT;
  if (percent > 0 && percent < 100) {
    return {
      original,
      discounted: Number((original * (1 - percent / 100)).toFixed(2)),
    };
  }

  return { original, discounted: original };
}
