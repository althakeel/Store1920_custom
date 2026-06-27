import Product from '@/models/Product';
import { sendWhatsAppTemplate, normalizePhoneForWaba, resolveWhatsAppHeaderImage } from '@/lib/whatsapp/elasticWaba';
import { buildWhatsAppProductPayload, resolveWhatsAppFreeShippingLabel } from '@/lib/whatsapp/productPayload';
import {
  WABA_TEMPLATE_NAMES,
  formatAedPrice,
  formatPaymentMethodLabel,
  getAppBaseUrl,
} from '@/lib/whatsapp/templates';
import { resolveAbandonedCheckoutOfferTotal } from '@/lib/whatsapp/abandonedCartOffer';
import { STORE1920_LOGO_URL } from '@/lib/brandLogo';
import { getDisplayOrderNumber } from '@/lib/orderDisplay';
import {
  isConfirmedPaidOrder,
  isFailedOrCancelledOrder,
  shouldSendOrderConfirmationOnCreate,
} from '@/lib/orderConfirmationPolicy';
import { isAwaitingPaymentOrder } from '@/lib/deferredOrderStatus';

const PAID_ON_CREATE_METHODS = new Set([
  'CARD',
  'RAZORPAY',
  'UPI',
  'NETBANKING',
  'ONLINE',
  'PREPAID',
  'WALLET',
]);

function getCustomerName(order) {
  return (
    order?.shippingAddress?.name
    || order?.guestName
    || order?.userId?.name
    || 'Customer'
  );
}

function getCustomerPhone(order) {
  const shipping = order?.shippingAddress || {};
  return {
    phone: shipping.phone || order?.guestPhone || '',
    phoneCode: shipping.phoneCode || order?.alternatePhoneCode || '+971',
  };
}

function formatAddress(order) {
  const address = order?.shippingAddress || {};
  const parts = [
    address.street,
    address.district,
    address.city,
    address.state,
    address.country,
  ].filter(Boolean);
  return parts.join(', ') || 'Address on file';
}

async function resolveProductSummary(order) {
  const items = Array.isArray(order?.orderItems) ? order.orderItems : [];
  if (!items.length) return 'Your order';

  const firstItem = items[0];
  const populatedName = firstItem?.productId?.name || firstItem?.name;
  if (populatedName) {
    return items.length > 1 ? `${populatedName} +${items.length - 1} more` : populatedName;
  }

  const productIds = items.map((item) => item?.productId).filter(Boolean);
  if (productIds.length) {
    const products = await Product.find({ _id: { $in: productIds } }).select('name').lean();
    const nameById = new Map(products.map((product) => [String(product._id), product.name]));
    const firstName = nameById.get(String(productIds[0])) || 'Your order';
    return items.length > 1 ? `${firstName} +${items.length - 1} more` : firstName;
  }

  return 'Your order';
}

async function resolvePrimaryProductPayload(order) {
  const firstItem = Array.isArray(order?.orderItems) ? order.orderItems[0] : null;
  const populated = firstItem?.productId;
  if (populated && typeof populated === 'object' && populated.name) {
    return buildWhatsAppProductPayload(populated);
  }

  const productId = populated || firstItem?.productId;
  if (!productId) return null;

  const product = await Product.findById(productId).lean();
  return product ? buildWhatsAppProductPayload(product) : null;
}

function getFallbackHeaderImage() {
  return String(process.env.WABA_CART_REMINDER_FALLBACK_IMAGE || STORE1920_LOGO_URL || '').trim();
}

function getHeaderImage(product) {
  return resolveWhatsAppHeaderImage(product?.imageUrl, getFallbackHeaderImage());
}

function formatOrderNumberForWhatsApp(order) {
  const number = getDisplayOrderNumber(order);
  if (!number) return 'N/A';
  return String(number).startsWith('#') ? String(number) : `#${number}`;
}

function shouldSendPaidConfirmation(order, paymentMethod) {
  const method = String(paymentMethod || order?.paymentMethod || '').toUpperCase();
  if (order?.isPaid === true) return true;
  if (PAID_ON_CREATE_METHODS.has(method)) return true;
  return false;
}

function formatPriceValue(order, includeCurrency = true) {
  const total = Number(order?.total || 0);
  const formatted = Number.isFinite(total)
    ? (total % 1 === 0 ? total.toFixed(0) : total.toFixed(2))
    : '0';
  return includeCurrency ? `${formatted} AED` : formatted;
}

async function sendLegacyConfirmationTemplate(order, templateName, priceIncludesCurrency) {
  const { phone, phoneCode } = getCustomerPhone(order);
  if (!phone) {
    return { skipped: true, reason: 'No customer phone on order' };
  }

  const productSummary = await resolveProductSummary(order);

  return sendWhatsAppTemplate({
    to: phone,
    phoneCode,
    templateName,
    bodyParams: [
      getCustomerName(order),
      getDisplayOrderNumber(order) || 'N/A',
      productSummary,
      formatPriceValue(order, priceIncludesCurrency),
      formatAddress(order),
      normalizePhoneForWaba(phone, phoneCode) || String(phone || '').trim(),
      order?.shippingAddress?.email || order?.guestEmail || order?.userId?.email || '',
    ],
  });
}

export async function sendCodConfirmationWhatsApp(order) {
  try {
    const { phone, phoneCode } = getCustomerPhone(order);
    if (!phone) {
      return { skipped: true, reason: 'No customer phone on order' };
    }

    const product = await resolvePrimaryProductPayload(order);
    const imageUrl = getHeaderImage(product);
    if (!imageUrl) {
      return { skipped: true, reason: 'Missing header image for COD WhatsApp template' };
    }

    return await sendWhatsAppTemplate({
      to: phone,
      phoneCode,
      templateName: WABA_TEMPLATE_NAMES.codConfirmation,
      bodyParams: [
        getCustomerName(order),
        formatOrderNumberForWhatsApp(order),
        formatPaymentMethodLabel(order?.paymentMethod || 'COD'),
      ],
      headerImageUrl: imageUrl,
      buttonUrlSuffix: process.env.WABA_COD_BUTTON_PATH || '/orders',
    });
  } catch (error) {
    console.error('[whatsapp] COD confirmation failed:', error);
    return { success: false, error: error.message };
  }
}

export async function sendOrderCreatedWhatsApp(order, paymentMethod) {
  try {
    if (isFailedOrCancelledOrder(order) || isAwaitingPaymentOrder(order)) {
      return { skipped: true, reason: 'Order is not confirmed' };
    }

    if (!shouldSendOrderConfirmationOnCreate(order, paymentMethod)) {
      return { skipped: true, reason: 'Deferred payment — waiting for payment confirmation' };
    }

    const method = String(paymentMethod || order?.paymentMethod || '').toUpperCase();
    if (method === 'COD') {
      return await sendCodConfirmationWhatsApp(order);
    }

    if (shouldSendPaidConfirmation(order, paymentMethod)) {
      return await sendLegacyConfirmationTemplate(order, WABA_TEMPLATE_NAMES.paidOrderConfirmation, false);
    }

    return await sendCodConfirmationWhatsApp(order);
  } catch (error) {
    console.error('[whatsapp] order created notification failed:', error);
    return { success: false, error: error.message };
  }
}

export async function sendOrderPaidWhatsApp(order) {
  try {
    if (!isConfirmedPaidOrder(order)) {
      return { skipped: true, reason: 'Order is not paid' };
    }

    return await sendLegacyConfirmationTemplate(order, WABA_TEMPLATE_NAMES.paidOrderConfirmation, false);
  } catch (error) {
    console.error('[whatsapp] paid order notification failed:', error);
    return { success: false, error: error.message };
  }
}

export async function sendOrderShippedWhatsApp(order) {
  try {
    const { phone, phoneCode } = getCustomerPhone(order);
    if (!phone) {
      return { skipped: true, reason: 'No customer phone on order' };
    }

    const trackingId = String(order?.trackingId || '').trim() || 'Pending';
    const trackingUrl = String(
      order?.trackingUrl
      || `${getAppBaseUrl()}/orders`,
    ).trim();

    return await sendWhatsAppTemplate({
      to: phone,
      phoneCode,
      templateName: WABA_TEMPLATE_NAMES.orderShipped,
      bodyParams: [
        getCustomerName(order),
        getDisplayOrderNumber(order) || 'N/A',
        trackingId,
        trackingUrl,
      ],
    });
  } catch (error) {
    console.error('[whatsapp] shipped notification failed:', error);
    return { success: false, error: error.message };
  }
}

export async function sendOrderDeliveredWhatsApp(order) {
  try {
    const { phone, phoneCode } = getCustomerPhone(order);
    if (!phone) {
      return { skipped: true, reason: 'No customer phone on order' };
    }

    const product = await resolvePrimaryProductPayload(order);
    const imageUrl = getHeaderImage(product);
    if (!imageUrl) {
      return { skipped: true, reason: 'Missing header image for delivered WhatsApp template' };
    }

    const productSummary = await resolveProductSummary(order);

    return await sendWhatsAppTemplate({
      to: phone,
      phoneCode,
      templateName: WABA_TEMPLATE_NAMES.orderDelivered,
      bodyParams: [
        getCustomerName(order),
        getDisplayOrderNumber(order) || 'N/A',
        productSummary,
      ],
      headerImageUrl: imageUrl,
      buttonUrlSuffix: process.env.WABA_DELIVERED_BUTTON_PATH || '/products',
    });
  } catch (error) {
    console.error('[whatsapp] delivered notification failed:', error);
    return { success: false, error: error.message };
  }
}

export async function sendPromotionalOfferWhatsApp({
  customerName,
  phone,
  phoneCode,
  couponCode,
  discountLabel,
  availabilityLabel = 'Available',
  product,
  buttonPath = '/products',
}) {
  try {
    if (!phone) {
      return { skipped: true, reason: 'No customer phone' };
    }

    const imageUrl = getHeaderImage(product);
    if (!imageUrl) {
      return { skipped: true, reason: 'Missing header image for promotional WhatsApp template' };
    }

    return await sendWhatsAppTemplate({
      to: phone,
      phoneCode,
      templateName: WABA_TEMPLATE_NAMES.promotionalOffer,
      bodyParams: [
        customerName || 'Customer',
        String(couponCode || '').trim() || 'OFFER',
        String(discountLabel || '').trim() || '5%',
        availabilityLabel || 'Available',
      ],
      headerImageUrl: imageUrl,
      buttonUrlSuffix: buttonPath,
    });
  } catch (error) {
    console.error('[whatsapp] promotional offer failed:', error);
    return { success: false, error: error.message };
  }
}

function formatCartReminderPrice(product, cartTotal) {
  if (cartTotal != null && Number.isFinite(Number(cartTotal))) {
    return formatAedPrice(cartTotal);
  }

  const price = Number(product?.price ?? 0);
  if (!Number.isFinite(price) || price <= 0) return '0 AED';
  return formatAedPrice(price);
}

export async function sendCartReminderWhatsApp({
  customerName,
  phone,
  phoneCode,
  product,
  cartTotal,
  buttonPath = '/cart',
}) {
  try {
    if (!phone) {
      return { skipped: true, reason: 'No customer phone' };
    }

    const imageUrl = getHeaderImage(product);
    if (!imageUrl) {
      return {
        skipped: true,
        reason: 'Missing header image for WhatsApp template. Set WABA_CART_REMINDER_FALLBACK_IMAGE in .env',
      };
    }

    const freeShippingLabel = resolveWhatsAppFreeShippingLabel(product, { cartTotal });

    return await sendWhatsAppTemplate({
      to: phone,
      phoneCode,
      templateName: WABA_TEMPLATE_NAMES.cartReminder,
      bodyParams: [
        customerName || 'Customer',
        formatCartReminderPrice(product, cartTotal),
        freeShippingLabel,
      ],
      headerImageUrl: imageUrl,
      buttonUrlSuffix: buttonPath,
    });
  } catch (error) {
    console.error('[whatsapp] cart reminder failed:', error);
    return { success: false, error: error.message };
  }
}

export async function sendAbandonedCheckoutWhatsApp({
  customerName,
  phone,
  phoneCode,
  product,
  cartTotal,
  offerTotal,
}) {
  try {
    if (!phone) {
      return { skipped: true, reason: 'No customer phone' };
    }

    const imageUrl = getHeaderImage(product);
    if (!imageUrl) {
      return { skipped: true, reason: 'Missing header image for abandoned checkout WhatsApp template' };
    }

    const { original: originalTotal, discounted: discountedTotal } = resolveAbandonedCheckoutOfferTotal(
      {},
      Number(cartTotal ?? product?.originalPrice ?? product?.price ?? 0),
    );
    const resolvedOriginal = Number(cartTotal ?? originalTotal ?? product?.originalPrice ?? product?.price ?? 0);
    let resolvedDiscounted = Number(offerTotal);
    if (!Number.isFinite(resolvedDiscounted) || resolvedDiscounted <= 0 || resolvedDiscounted >= resolvedOriginal) {
      resolvedDiscounted = discountedTotal;
    }
    if (resolvedDiscounted >= resolvedOriginal && resolvedOriginal > 0) {
      const fallback = resolveAbandonedCheckoutOfferTotal({}, resolvedOriginal);
      resolvedDiscounted = fallback.discounted;
    }

    const freeShippingLabel = resolveWhatsAppFreeShippingLabel(product, { cartTotal: resolvedDiscounted });
    const cartUrl = product?.cartUrl || `${getAppBaseUrl()}/cart`;

    return await sendWhatsAppTemplate({
      to: phone,
      phoneCode,
      templateName: WABA_TEMPLATE_NAMES.abandonedCheckout,
      bodyParams: [
        customerName || 'Customer',
        formatAedPrice(resolvedOriginal),
        formatAedPrice(resolvedDiscounted),
        freeShippingLabel,
        cartUrl,
      ],
      headerImageUrl: imageUrl,
    });
  } catch (error) {
    console.error('[whatsapp] abandoned checkout reminder failed:', error);
    return { success: false, error: error.message };
  }
}

export async function sendOrderReminderWhatsApp({ customerName, orderNumber, phone, phoneCode }) {
  try {
    if (!phone) {
      return { skipped: true, reason: 'No customer phone' };
    }

    return await sendWhatsAppTemplate({
      to: phone,
      phoneCode,
      templateName: WABA_TEMPLATE_NAMES.orderReminder,
      bodyParams: [
        customerName || 'Customer',
        String(orderNumber || '').trim() || 'N/A',
      ],
    });
  } catch (error) {
    console.error('[whatsapp] order reminder failed:', error);
    return { success: false, error: error.message };
  }
}

export async function sendOrderStatusWhatsApp(order, status) {
  const normalizedStatus = String(status || '').toUpperCase();
  if (normalizedStatus === 'SHIPPED') {
    return sendOrderShippedWhatsApp(order);
  }
  if (normalizedStatus === 'DELIVERED') {
    return sendOrderDeliveredWhatsApp(order);
  }
  return { skipped: true, reason: 'No WhatsApp template for status' };
}

export async function sendDeferredPaymentWhatsApp(order) {
  try {
    if (!isConfirmedPaidOrder(order)) {
      return { skipped: true, reason: 'Order is not paid yet' };
    }
    return await sendOrderPaidWhatsApp(order);
  } catch (error) {
    console.error('[whatsapp] deferred payment notification failed:', error);
    return { success: false, error: error.message };
  }
}
