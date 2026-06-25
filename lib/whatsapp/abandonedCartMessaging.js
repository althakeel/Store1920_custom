import Product from '@/models/Product';
import { getAbandonedCartTotal, getAbandonedCartDisplayName } from '@/lib/abandonedCartUtils';
import { buildWhatsAppProductPayload } from '@/lib/whatsapp/productPayload';
import {
  sendAbandonedCheckoutWhatsApp,
  sendCartReminderWhatsApp,
} from '@/lib/whatsapp/orderNotifications';

export async function resolveAbandonedCartProductPayload(cart = {}) {
  const items = Array.isArray(cart.items) ? cart.items : [];
  const firstItem = items[0];
  const productId = String(firstItem?.productId || firstItem?.id || '').trim();
  if (!productId) return null;

  const product = await Product.findById(productId).lean();
  return product ? buildWhatsAppProductPayload(product) : null;
}

export async function sendAbandonedCartWhatsAppReminder(cart = {}, options = {}) {
  const phone = String(cart?.phone || '').trim();
  if (!phone) {
    return { skipped: true, reason: 'No customer phone on abandoned cart' };
  }

  const product = await resolveAbandonedCartProductPayload(cart);
  const cartTotal = getAbandonedCartTotal(cart);
  const customerName = getAbandonedCartDisplayName(cart);
  const offerTotal = options.offerTotal ?? cart.recoveryOfferTotal ?? null;

  let buttonPath = options.buttonPath || '/cart';
  if (options.useRecoveryLink && cart.recoveryToken) {
    buttonPath = `/recover-cart/${cart.recoveryToken}`;
  }

  const payload = {
    customerName,
    phone,
    phoneCode: cart?.phoneCode || options.phoneCode || '+971',
    product,
    cartTotal: offerTotal ?? cartTotal,
    buttonPath,
  };

  if (options.variant === 'checkout') {
    return sendAbandonedCheckoutWhatsApp({
      customerName,
      phone,
      phoneCode: cart?.phoneCode || options.phoneCode || '+971',
      product,
      cartTotal,
      offerTotal: offerTotal ?? cart.recoveryOfferTotal ?? null,
    });
  }

  return sendCartReminderWhatsApp(payload);
}
