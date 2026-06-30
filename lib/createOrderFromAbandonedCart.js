import Order from '@/models/Order';
import { normalizeConversionPaymentMethod } from '@/lib/abandonedCartRecoveryPayment';

function mapConversionPaymentToOrder(method) {
  const normalized = normalizeConversionPaymentMethod(method);
  if (normalized === 'cod') return 'COD';
  if (normalized === 'card') return 'CARD';
  if (normalized === 'stripe') return 'STRIPE';
  if (normalized === 'tabby') return 'TABBY';
  if (normalized === 'tamara') return 'TAMARA';
  return normalized.toUpperCase();
}

function buildPaymentReferenceUpdate(paymentMethod, paymentReferenceId) {
  const referenceId = String(paymentReferenceId || '').trim();
  if (!referenceId) return {};

  if (paymentMethod === 'TABBY') {
    return { tabbyPaymentId: referenceId };
  }
  if (paymentMethod === 'TAMARA') {
    return { tamaraOrderId: referenceId };
  }
  return {};
}

function buildOrderItemsFromCart(cart = {}) {
  return (Array.isArray(cart.items) ? cart.items : [])
    .map((item) => {
      const productId = String(item?.productId || '').trim();
      if (!productId) return null;
      return {
        id: productId,
        quantity: Math.max(1, Number(item?.quantity) || 1),
        ...(item?.variantOptions ? { variantOptions: item.variantOptions } : {}),
      };
    })
    .filter(Boolean);
}

export function buildGuestInfoFromAbandonedCart(cart = {}, {
  customerName,
  customerEmail,
  customerPhone,
} = {}) {
  const addr = cart?.address && typeof cart.address === 'object' ? cart.address : {};
  const phoneCode = String(cart?.phoneCode || '+971').trim() || '+971';
  const phone = String(customerPhone || cart?.phone || '').replace(/\D/g, '');
  const email = String(customerEmail || cart?.email || '').trim().toLowerCase();

  if (!phone) {
    throw new Error('Customer phone is required to create an order from this abandoned checkout');
  }

  return {
    name: String(customerName || cart?.name || 'Customer').trim() || 'Customer',
    email: email || `recovery.${phone}@customers.store1920.com`,
    phone,
    phoneCode,
    alternatePhone: '',
    alternatePhoneCode: phoneCode,
    street: String(addr.street || addr.address || 'Address pending confirmation').trim(),
    address: String(addr.street || addr.address || 'Address pending confirmation').trim(),
    city: String(addr.city || addr.district || 'Dubai').trim(),
    state: String(addr.state || addr.district || 'Dubai').trim(),
    district: String(addr.district || '').trim(),
    country: String(addr.country || 'United Arab Emirates').trim(),
    pincode: String(addr.pincode || addr.zip || '00000').trim(),
    zip: String(addr.zip || addr.pincode || '00000').trim(),
  };
}

/**
 * Create a store order when staff converts an abandoned checkout.
 * Idempotent when cart.linkedOrderId already points to a live order.
 */
export async function createOrderFromAbandonedCart(cart = {}, {
  storeId,
  finalTotal,
  paymentMethod = 'cod',
  convertedByName,
  convertedByUserId,
  conversionNote,
  customerName,
  customerEmail,
  customerPhone,
  requestUrl,
  markPaid = false,
  awaitingPayment = false,
  paymentReferenceId,
} = {}) {
  if (!storeId || !cart?._id) {
    throw new Error('Missing store or cart for order creation');
  }

  const linkedId = String(cart.linkedOrderId || '').trim();
  if (linkedId) {
    const existing = await Order.findOne({ _id: linkedId, storeId }).lean();
    if (existing) {
      return { orderId: String(existing._id), order: existing, created: false };
    }
  }

  const items = buildOrderItemsFromCart(cart);
  if (!items.length) {
    throw new Error('Abandoned checkout has no products to order');
  }

  const guestInfo = buildGuestInfoFromAbandonedCart(cart, {
    customerName,
    customerEmail,
    customerPhone,
  });

  const normalizedMethod = mapConversionPaymentToOrder(paymentMethod);
  const parsedTotal = Number(finalTotal ?? cart.convertedCartTotal ?? cart.cartTotal ?? 0);
  const normalizedRecoveryMethod = normalizeConversionPaymentMethod(paymentMethod);
  const isCod = normalizedRecoveryMethod === 'cod';
  const isCard = normalizedRecoveryMethod === 'card';
  const referenceId = String(paymentReferenceId || cart.conversionPaymentLinkId || '').trim();

  const orderPayload = {
    isGuest: true,
    guestInfo,
    items,
    paymentMethod: normalizedMethod,
    shippingFee: 0,
    manualStoreOrder: true,
    paymentStatus: awaitingPayment || isCod ? 'PENDING' : 'PAID',
    attribution: {
      utmSource: 'store_admin',
      utmMedium: 'abandoned_checkout_conversion',
      utmCampaign: String(cart._id),
    },
  };

  const baseUrl = requestUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const orderRequest = new Request(new URL('/api/orders', baseUrl).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload),
  });

  const { POST: createOrder } = await import('@/app/api/orders/route');
  const orderResponse = await createOrder(orderRequest);
  const orderData = await orderResponse.json();

  if (!orderResponse.ok) {
    const detail = orderData?.error || orderData?.message || 'Failed to create order';
    const missing = Array.isArray(orderData?.missingFields) ? orderData.missingFields.join(', ') : '';
    throw new Error(missing ? `${detail} (${missing})` : detail);
  }

  const orderId = String(
    orderData.orderId || orderData.id || orderData.order?._id || orderData.orders?.[0]?._id || '',
  ).trim();

  if (!orderId) {
    throw new Error('Order was created but no order id was returned');
  }

  const noteLines = [
    conversionNote ? String(conversionNote).trim() : '',
    `Recovered from abandoned checkout ${cart._id}`,
    convertedByName ? `Converted by ${convertedByName}` : '',
    referenceId ? `${normalizedMethod} reference: ${referenceId}` : '',
  ].filter(Boolean);

  let paid = false;
  let status = 'ORDER_PLACED';
  if (awaitingPayment) {
    paid = false;
    status = 'AWAITING_PAYMENT';
  } else if (isCod) {
    paid = false;
  } else if (isCard || markPaid) {
    paid = true;
  }

  const savedOrder = await Order.findOneAndUpdate(
    { _id: orderId, storeId },
    {
      $set: {
        total: Number.isFinite(parsedTotal) ? parsedTotal : undefined,
        manualStoreOrder: true,
        storeCreatedByUid: convertedByUserId ? String(convertedByUserId) : null,
        storeCreatedByName: convertedByName ? String(convertedByName).trim() : null,
        status,
        isPaid: paid,
        paymentStatus: paid ? 'PAID' : 'PENDING',
        notes: noteLines.join('\n'),
        ...(referenceId ? { paymentReferenceId: referenceId } : {}),
        ...buildPaymentReferenceUpdate(normalizedMethod, referenceId),
        ...(cart.userId && cart.userId !== 'guest' ? { userId: String(cart.userId) } : {}),
      },
    },
    { new: true },
  ).lean();

  return {
    orderId,
    order: savedOrder,
    created: true,
  };
}

export async function markLinkedOrderPaidFromAbandonedCart(cart = {}, { storeId } = {}) {
  const orderId = String(cart?.linkedOrderId || '').trim();
  if (!orderId || !storeId) return null;

  return Order.findOneAndUpdate(
    { _id: orderId, storeId },
    {
      $set: {
        status: 'ORDER_PLACED',
        isPaid: true,
        paymentStatus: 'PAID',
      },
    },
    { new: true },
  ).lean();
}
