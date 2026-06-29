import Product from '@/models/Product';
import { getAbandonedCartTotal, getAbandonedCartDisplayName } from '@/lib/abandonedCartUtils';
import { getProductThumbnailUrl } from '@/lib/productMedia';
import { getCustomerSiteUrl } from '@/lib/appUrl';
import { getAbandonedCartDisplayItems } from '@/lib/abandonedCartLineItems';
import { buildWhatsAppProductPayload } from '@/lib/whatsapp/productPayload';
import { resolveAbandonedCheckoutOfferTotal } from '@/lib/whatsapp/abandonedCartOffer';
import {
  sendAbandonedCheckoutWhatsApp,
  sendCartReminderWhatsApp,
} from '@/lib/whatsapp/orderNotifications';

function ensureAbsoluteHttpsUrl(url) {
  const value = String(url || '').trim();
  if (!value || value === '/placeholder.png') return '';
  if (/^https:\/\//i.test(value)) return value;
  const base = getCustomerSiteUrl();
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `${base}${value}`;
  return `${base}/${value.replace(/^\//, '')}`;
}

export async function resolveAbandonedCartProductPayload(cart = {}) {
  const items = Array.isArray(cart.items)
    ? cart.items.filter((item) => String(item?.productId || item?.id || '').trim())
    : [];
  if (!items.length) return null;

  const sortedItems = [...getAbandonedCartDisplayItems(cart)].sort(
    (a, b) => Number(b.lineTotal || 0) - Number(a.lineTotal || 0),
  );
  const primaryItem = sortedItems[0];
  if (!primaryItem) return null;

  const productId = String(primaryItem?.productId?._id || primaryItem?.productId || '').trim();
  if (!productId) return null;

  const product = await Product.findById(productId).lean();
  if (!product) return null;

  const payload = buildWhatsAppProductPayload(product);
  if (primaryItem.isBulkBundle) {
    const bundleUnits = Number(primaryItem.bundleUnits || primaryItem.quantity || 0);
    if (bundleUnits > 0) {
      payload.name = `${payload.name} — Bundle of ${bundleUnits}`;
    }
  }
  const itemImage = ensureAbsoluteHttpsUrl(primaryItem?.imageUrl || primaryItem?.image || '');
  if (itemImage) {
    payload.imageUrl = itemImage;
  } else if (!payload.imageUrl) {
    payload.imageUrl = ensureAbsoluteHttpsUrl(getProductThumbnailUrl(product, { fallback: '' }));
  }

  return payload;
}

export async function sendAbandonedCartWhatsAppReminder(cart = {}, options = {}) {
  const phone = String(cart?.phone || '').trim();
  if (!phone) {
    return { skipped: true, reason: 'No customer phone on abandoned cart' };
  }

  const product = await resolveAbandonedCartProductPayload(cart);
  const cartTotal = getAbandonedCartTotal(cart);
  const customerName = getAbandonedCartDisplayName(cart);
  const { original: originalTotal, discounted: computedOfferTotal } = resolveAbandonedCheckoutOfferTotal(
    cart,
    cartTotal,
  );
  const offerTotal = options.offerTotal ?? cart.recoveryOfferTotal ?? computedOfferTotal;

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
      cartTotal: originalTotal || cartTotal,
      offerTotal: offerTotal ?? computedOfferTotal,
    });
  }

  return sendCartReminderWhatsApp(payload);
}
