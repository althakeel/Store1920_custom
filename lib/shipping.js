// lib/shipping.js
import axios from 'axios';
import {
  getDefaultShippingOption,
  resolveShippingOptions,
} from '@/lib/shippingOptions';

export async function fetchShippingSettings(storeId) {
  try {
    const params = { t: new Date().getTime() };
    if (storeId) params.storeId = storeId;
    const { data } = await axios.get('/api/shipping', { params });
    const setting = data.setting;
    if (setting) {
      setting.shippingOptions = resolveShippingOptions(setting);
    }
    return setting;
  } catch (error) {
    console.error('Error fetching shipping settings:', error);
    return null;
  }
}

function getLineSubtotal(cartItems) {
  return cartItems.reduce((sum, item) => {
    const lineTotal = Number(item?._lineTotal);
    if (Number.isFinite(lineTotal)) return sum + lineTotal;
    const price = Number(item?._cartPrice ?? item?.price ?? 0) || 0;
    return sum + price * item.quantity;
  }, 0);
}

function getTotalItemWeight(cartItems) {
  return cartItems.reduce((sum, item) => {
    const weight = Number(item?.weight ?? item?.productWeight ?? 0) || 0;
    return sum + weight * Number(item?.quantity || 0);
  }, 0);
}

function calculateOptionBaseFee({ cartItems, option, subtotal, stateFee }) {
  const shippingType = option?.shippingType || 'FLAT_RATE';

  if (shippingType === 'FREE') {
    return 0;
  }

  if (shippingType === 'FLAT_RATE') {
    return Number(option.flatRate || 0);
  }

  if (shippingType === 'PER_ITEM') {
    const totalItems = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    let fee = Number(option.perItemFee || 0) * totalItems;
    if (option.maxItemFee != null) {
      fee = Math.min(fee, Number(option.maxItemFee || 0));
    }
    return fee;
  }

  if (shippingType === 'WEIGHT_BASED') {
    const totalWeight = getTotalItemWeight(cartItems);
    const baseWeight = Number(option.baseWeight || 1);
    const baseWeightFee = Number(option.baseWeightFee || 0);
    const additionalWeightFee = Number(option.additionalWeightFee || 0);

    if (totalWeight <= baseWeight) {
      return baseWeightFee;
    }

    const extraUnits = Math.ceil(totalWeight - baseWeight);
    return baseWeightFee + extraUnits * additionalWeightFee;
  }

  return Number(option?.flatRate || 0);
}

export function calculateShipping({
  cartItems,
  shippingSetting,
  shippingOption = null,
  paymentMethod = 'CARD',
  shippingState = '',
}) {
  if (!shippingSetting || !shippingSetting.enabled) return 0;

  const option =
    shippingOption
    || getDefaultShippingOption(shippingSetting, shippingState)
    || resolveShippingOptions(shippingSetting)[0];

  if (!option) return 0;

  const hasProductSpecificFreeShipping = cartItems.some((item) => Boolean(item?.freeShippingEligible));
  if (hasProductSpecificFreeShipping) {
    let shippingFee = 0;
    if (paymentMethod === 'COD' && shippingSetting.enableCOD && shippingSetting.codFee) {
      shippingFee += shippingSetting.codFee;
    }
    return shippingFee;
  }

  const normalizedState = String(shippingState || '').trim().toLowerCase();
  const stateFeeEntry = Array.isArray(shippingSetting.stateCharges)
    ? shippingSetting.stateCharges.find(
        (entry) => String(entry?.state || '').trim().toLowerCase() === normalizedState,
      )
    : null;
  const stateFee = stateFeeEntry ? Number(stateFeeEntry.fee || 0) : null;
  const subtotal = getLineSubtotal(cartItems);

  let shippingFee = calculateOptionBaseFee({ cartItems, option, subtotal, stateFee });

  if (
    option.shippingType === 'FLAT_RATE'
    && shippingSetting.freeShippingMin
    && subtotal >= shippingSetting.freeShippingMin
    && typeof stateFee !== 'number'
  ) {
    shippingFee = 0;
  }

  if (typeof stateFee === 'number') {
    shippingFee = stateFee;
  }

  if (paymentMethod === 'COD' && shippingSetting.enableCOD && shippingSetting.codFee) {
    shippingFee += shippingSetting.codFee;
  }

  return shippingFee;
}
