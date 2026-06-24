import Product from '@/models/Product';
import { sendWhatsAppTemplate, normalizePhoneForWaba, resolveWhatsAppHeaderImage } from '@/lib/whatsapp/elasticWaba';
import { STORE1920_LOGO_URL } from '@/lib/brandLogo';
import { getDisplayOrderNumber } from '@/lib/orderDisplay';

const DEFERRED_PAYMENT_METHODS = new Set(['STRIPE', 'TAMARA', 'TABBY']);
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

function getCustomerEmail(order) {
  return (
    order?.shippingAddress?.email
    || order?.guestEmail
    || order?.userId?.email
    || ''
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

function formatPhoneForTemplate(order) {
  const { phone, phoneCode } = getCustomerPhone(order);
  return normalizePhoneForWaba(phone, phoneCode) || String(phone || '').trim();
}

function formatPrice(order, includeCurrency = true) {
  const total = Number(order?.total || 0);
  const formatted = Number.isFinite(total) ? total.toFixed(total % 1 === 0 ? 0 : 2) : '0';
  return includeCurrency ? `${formatted} AED` : formatted;
}

function shouldSendConfirmationOnCreate(order, paymentMethod) {
  const method = String(paymentMethod || order?.paymentMethod || '').toUpperCase();
  if (DEFERRED_PAYMENT_METHODS.has(method)) return false;
  return true;
}

function shouldSendPaidConfirmation(order, paymentMethod) {
  const method = String(paymentMethod || order?.paymentMethod || '').toUpperCase();
  if (order?.isPaid === true) return true;
  if (PAID_ON_CREATE_METHODS.has(method)) return true;
  return false;
}

async function sendConfirmationTemplate(order, templateName, priceIncludesCurrency) {
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
      formatPrice(order, priceIncludesCurrency),
      formatAddress(order),
      formatPhoneForTemplate(order),
      getCustomerEmail(order),
    ],
  });
}

export async function sendOrderCreatedWhatsApp(order, paymentMethod) {
  try {
    if (!shouldSendConfirmationOnCreate(order, paymentMethod)) {
      return { skipped: true, reason: 'Deferred payment — waiting for payment confirmation' };
    }

    if (shouldSendPaidConfirmation(order, paymentMethod)) {
      return await sendConfirmationTemplate(order, 'confirmation_paid_order', false);
    }

    return await sendConfirmationTemplate(order, 'order_confirmation_final', true);
  } catch (error) {
    console.error('[whatsapp] order created notification failed:', error);
    return { success: false, error: error.message };
  }
}

export async function sendOrderPaidWhatsApp(order) {
  try {
    return await sendConfirmationTemplate(order, 'confirmation_paid_order', false);
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
      || `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.store1920.com'}/orders`
    ).trim();

    return await sendWhatsAppTemplate({
      to: phone,
      phoneCode,
      templateName: 'order_shipped',
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

function formatCartReminderPrice(product, cartTotal) {
  if (cartTotal != null && Number.isFinite(Number(cartTotal))) {
    const total = Number(cartTotal);
    const formatted = total % 1 === 0 ? total.toFixed(0) : total.toFixed(2);
    return `${formatted} AED`;
  }

  const price = Number(product?.price ?? 0);
  if (!Number.isFinite(price) || price <= 0) return '0 AED';
  const formatted = price % 1 === 0 ? price.toFixed(0) : price.toFixed(2);
  return `${formatted} AED`;
}

function getCartReminderTemplateName() {
  return String(process.env.WABA_TEMPLATE_CART_REMINDER || 'cart_reminder_1920').trim();
}

function getCartReminderHeaderImage(product) {
  const fallback = String(
    process.env.WABA_CART_REMINDER_FALLBACK_IMAGE || STORE1920_LOGO_URL || '',
  ).trim();
  return resolveWhatsAppHeaderImage(product?.imageUrl, fallback);
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

    const imageUrl = getCartReminderHeaderImage(product);
    if (!imageUrl) {
      return {
        skipped: true,
        reason: 'Missing header image for WhatsApp template. Set WABA_CART_REMINDER_FALLBACK_IMAGE in .env',
      };
    }
    const freeShippingLabel = product?.freeShippingLabel
      || (product?.freeShipping ? 'Available' : 'Not available');

    const normalizedTo = normalizePhoneForWaba(phone, phoneCode);
    if (!normalizedTo) {
      return { skipped: true, reason: 'Invalid phone number. Use UAE format: 05xxxxxxxx' };
    }

    return await sendWhatsAppTemplate({
      to: phone,
      phoneCode,
      templateName: getCartReminderTemplateName(),
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

export async function sendAbandonedCheckoutWhatsApp(params) {
  return sendCartReminderWhatsApp({
    ...params,
    buttonPath: '/checkout',
  });
}

export async function sendOrderReminderWhatsApp({ customerName, orderNumber, phone, phoneCode }) {
  try {
    if (!phone) {
      return { skipped: true, reason: 'No customer phone' };
    }

    return await sendWhatsAppTemplate({
      to: phone,
      phoneCode,
      templateName: 'order_reminder_',
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
  return { skipped: true, reason: 'No WhatsApp template for status' };
}

export async function sendDeferredPaymentWhatsApp(order) {
  try {
    const method = String(order?.paymentMethod || '').toUpperCase();
    const deferredMethods = new Set(['STRIPE', 'TAMARA', 'TABBY']);
    if (!order?.isPaid && !deferredMethods.has(method)) {
      return { skipped: true, reason: 'Order is not paid yet' };
    }
    return await sendOrderPaidWhatsApp(order);
  } catch (error) {
    console.error('[whatsapp] deferred payment notification failed:', error);
    return { success: false, error: error.message };
  }
}
