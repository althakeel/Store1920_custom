import { getOrderPaymentReferenceId, buildGuestInfoFromForm, mapStoreOrderPaymentMethod, resolveGuestCity } from '@/lib/storeCreateOrder';
import { getStoreOrderDisplayItems } from '@/lib/storeOrderLineItems';
import {
  formatVariantOptionsLabel,
  matchVariantByOptions,
  normalizeSellerVariantOptions,
} from '@/lib/productVariantOptions';

export function mapApiPaymentToFormValue(paymentMethod = '') {
  const method = String(paymentMethod || 'COD').toUpperCase();
  if (method === 'COD') return 'cod';
  if (method === 'STRIPE') return 'stripe';
  if (method === 'TABBY') return 'tabby';
  if (method === 'TAMARA') return 'tamara';
  if (method === 'WALLET') return 'wallet';
  if (method === 'RAZORPAY') return 'card';
  return method.toLowerCase() || 'cod';
}

export function orderToEditForm(order = {}) {
  const shipping = order.shippingAddress || {};
  const user = order.userId && typeof order.userId === 'object' ? order.userId : null;

  return {
    name: shipping.name || order.guestName || user?.name || '',
    email: shipping.email || order.guestEmail || user?.email || '',
    phone: shipping.phone || order.guestPhone || '',
    phoneCode: shipping.phoneCode || order.alternatePhoneCode || '+971',
    street: shipping.street || shipping.address || '',
    state: shipping.state || 'Dubai',
    district: shipping.district || '',
    country: shipping.country || 'United Arab Emirates',
    pincode: shipping.zip || shipping.pincode || '',
    payment: mapApiPaymentToFormValue(order.paymentMethod),
    paymentReferenceId: getOrderPaymentReferenceId(order),
    isPaid: Boolean(order.isPaid),
    paymentStatus: String(order.paymentStatus || 'PENDING').toUpperCase(),
    shippingFee: Number(order.shippingFee || 0),
    total: Number(order.total || 0),
    notes: String(order.notes || ''),
  };
}

export function orderToEditLineItems(order = {}) {
  return getStoreOrderDisplayItems(order).map((item, index) => ({
    key: `${index}-${item.productId?._id || item.productId || index}`,
    productId: item.productId?._id ? String(item.productId._id) : String(item.productId || ''),
    product: item.productId && typeof item.productId === 'object' ? item.productId : null,
    name: item.name || '',
    price: Number(item.price || 0),
    quantity: Math.max(1, Number(item.packQuantity || 1)),
    bundleUnits: Number(item.bundleUnits || 0),
    isBulkBundle: Boolean(item.isBulkBundle),
    variantOptions: item.variantOptions || null,
    image: item.image || item.productId?.images?.[0] || '',
  }));
}

export function getEditOrderVariantChoices(product = {}) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  return variants.map((variant, index) => {
    const options = normalizeSellerVariantOptions(variant?.options);
    const label = formatVariantOptionsLabel(options)
      || String(variant?.name || variant?.sku || '').trim()
      || `Variant ${index + 1}`;

    return {
      index,
      label,
      sku: String(variant?.sku || '').trim(),
      price: Number(variant?.price ?? product?.price ?? product?.AED ?? 0),
      regularPrice: Number(variant?.AED ?? variant?.price ?? product?.AED ?? 0),
      stock: Number(variant?.stock ?? 0),
      options,
      variant,
    };
  });
}

export function getEditOrderSelectedVariantIndex(item = {}, product = {}) {
  const choices = getEditOrderVariantChoices(product);
  if (!choices.length) return -1;

  const matched = matchVariantByOptions(
    choices.map((choice) => choice.variant),
    item?.variantOptions || {},
  );
  if (!matched) return -1;
  return choices.findIndex((choice) => choice.variant === matched);
}

export function calculateEditOrderSubtotal(lineItems = []) {
  return lineItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)),
    0,
  );
}

/**
 * True when the saved order total does not equal the line-item subtotal + shipping,
 * i.e. staff previously set a manual total (e.g. a discounted abandoned-cart conversion).
 * Used to preserve that manual total instead of auto-recomputing it on edit.
 */
export function orderHasManualTotal(order = {}) {
  const subtotal = calculateEditOrderSubtotal(orderToEditLineItems(order));
  const shipping = Number(order.shippingFee || 0);
  const computedTotal = Number((subtotal + shipping).toFixed(2));
  const savedTotal = Number(order.total || 0);
  return savedTotal > 0 && Math.abs(savedTotal - computedTotal) > 0.01;
}

export function buildOrderDetailsUpdatePayload({
  form = {},
  lineItems = [],
  useManualTotal = false,
} = {}) {
  const guestInfo = buildGuestInfoFromForm(form);
  const paymentMethod = mapStoreOrderPaymentMethod(form.payment);
  const shippingFee = Number(form.shippingFee || 0);
  const subtotal = calculateEditOrderSubtotal(lineItems);
  const computedTotal = Number((subtotal + shippingFee).toFixed(2));
  const total = useManualTotal ? Number(form.total || 0) : computedTotal;

  const shippingAddress = {
    name: guestInfo.name,
    email: guestInfo.email,
    phone: guestInfo.phone,
    phoneCode: guestInfo.phoneCode,
    street: guestInfo.street,
    city: resolveGuestCity(guestInfo),
    state: guestInfo.state,
    district: guestInfo.district,
    country: guestInfo.country,
    zip: guestInfo.pincode,
    pincode: guestInfo.pincode,
  };

  const orderItems = lineItems
    .filter((item) => item.name && Number(item.quantity) > 0)
    .map((item) => ({
      productId: item.productId || undefined,
      name: String(item.name || '').trim(),
      price: Number(item.price || 0),
      quantity: Math.max(1, Number(item.quantity || 1)),
      ...(item.variantOptions ? { variantOptions: item.variantOptions } : {}),
    }));

  const payload = {
    shippingAddress,
    guestName: guestInfo.name,
    guestEmail: guestInfo.email,
    guestPhone: guestInfo.phone,
    paymentMethod,
    paymentStatus: form.isPaid ? 'PAID' : String(form.paymentStatus || 'PENDING').toUpperCase(),
    isPaid: Boolean(form.isPaid),
    shippingFee,
    total,
    orderItems,
    notes: String(form.notes || '').trim(),
  };

  const referenceId = String(form.paymentReferenceId || '').trim();
  if (referenceId) {
    payload.paymentReferenceId = referenceId;
    if (paymentMethod === 'TABBY') payload.tabbyPaymentId = referenceId;
    if (paymentMethod === 'TAMARA') payload.tamaraOrderId = referenceId;
  }

  return payload;
}
