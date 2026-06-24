// lib/shipping.js
import axios from 'axios';

export async function fetchShippingSettings() {
  try {
    // Add cache busting query parameter to force fresh data
    const { data } = await axios.get('/api/shipping', {
      params: { t: new Date().getTime() }
    });
    return data.setting;
  } catch (error) {
    console.error('Error fetching shipping settings:', error);
    return null;
  }
}

export function calculateShipping({ cartItems, shippingSetting, paymentMethod = 'CARD', shippingState = '' }) {
  // If no shipping settings or shipping is disabled, return 0
  if (!shippingSetting || !shippingSetting.enabled) return 0;

  const hasProductSpecificFreeShipping = cartItems.some((item) => Boolean(item?.freeShippingEligible));
  if (hasProductSpecificFreeShipping) {
    let shippingFee = 0;
    if (paymentMethod === 'COD' && shippingSetting.enableCOD && shippingSetting.codFee) {
      shippingFee += shippingSetting.codFee;
    }
    return shippingFee;
  }
  
  let shippingFee = 0;
  const normalizedState = String(shippingState || '').trim().toLowerCase();
  const stateFeeEntry = Array.isArray(shippingSetting.stateCharges)
    ? shippingSetting.stateCharges.find((entry) => String(entry?.state || '').trim().toLowerCase() === normalizedState)
    : null;
  const stateFee = stateFeeEntry ? Number(stateFeeEntry.fee || 0) : null;
  const subtotal = cartItems.reduce((sum, item) => {
    const lineTotal = Number(item?._lineTotal);
    if (Number.isFinite(lineTotal)) return sum + lineTotal;
    const price = Number(item?._cartPrice ?? item?.price ?? 0) || 0;
    return sum + price * item.quantity;
  }, 0);
  if (shippingSetting.shippingType === 'FLAT_RATE') {
    // Free shipping if subtotal exceeds freeShippingMin and no state charge
    if (shippingSetting.freeShippingMin && subtotal >= shippingSetting.freeShippingMin && typeof stateFee !== 'number') {
      shippingFee = 0;
    } else {
      shippingFee = shippingSetting.flatRate || 0;
    }
  } else if (shippingSetting.shippingType === 'PER_ITEM') {
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    let fee = (shippingSetting.perItemFee || 0) * totalItems;
    if (shippingSetting.maxItemFee) fee = Math.min(fee, shippingSetting.maxItemFee);
    shippingFee = fee;
  }

  // State-wise charges REPLACE base fee (they are the total shipping for that state)
  if (typeof stateFee === 'number') {
    shippingFee = stateFee;
  }
  
  // Add COD fee if payment method is COD and COD is enabled
  if (paymentMethod === 'COD' && shippingSetting.enableCOD && shippingSetting.codFee) {
    shippingFee += shippingSetting.codFee;
  }
  
  return shippingFee;
}
