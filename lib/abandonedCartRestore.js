import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import AbandonedCart from '@/models/AbandonedCart';
import { getAbandonedCartDisplayItems } from '@/lib/abandonedCartLineItems';

export function generateCartRestoreToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function cartRestoreTokenSetOnInsert() {
  return { cartRestoreToken: generateCartRestoreToken() };
}

export function buildCartRestorePath(token) {
  const value = String(token || '').trim();
  if (!value) return '/cart';
  return `/cart?restore=${encodeURIComponent(value)}`;
}

function normalizeRestoreVariantOptions(item = {}) {
  const bundleUnits = Number(item.bundleUnits || 0);
  const raw = item.variantOptions && typeof item.variantOptions === 'object'
    ? item.variantOptions
    : null;

  const cleaned = {};
  if (raw) {
    for (const [key, value] of Object.entries(raw)) {
      if (value == null) continue;
      const text = String(value).trim();
      if (!text) continue;
      cleaned[key] = value;
    }
  }

  if (bundleUnits > 0 && cleaned.bundleQty == null) {
    cleaned.bundleQty = bundleUnits;
  }

  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

export function buildCartRestorePayload(cart = {}) {
  return getAbandonedCartDisplayItems(cart)
    .map((item) => {
      const productId = String(item.productId || '').trim();
      if (!productId) return null;

      const variantOptions = normalizeRestoreVariantOptions(item);
      const quantity = Math.max(1, Number(item.packQuantity ?? item.quantity ?? 1));

      return {
        productId,
        entry: {
          quantity,
          price: Number(item.price || 0),
          ...(variantOptions ? { variantOptions } : {}),
        },
      };
    })
    .filter(Boolean);
}

export function resolveWhatsAppCartButtonPath(cart = {}) {
  const recoveryToken = String(cart.recoveryToken || '').trim();
  const offerTotal = Number(cart.recoveryOfferTotal);
  if (recoveryToken && Number.isFinite(offerTotal) && offerTotal > 0) {
    return `/recover-cart/${recoveryToken}`;
  }

  const restoreToken = String(cart.cartRestoreToken || '').trim();
  if (restoreToken) {
    return buildCartRestorePath(restoreToken);
  }

  return '/cart';
}

export async function ensureCartRestoreToken(cartOrId) {
  await connectDB();

  const id = typeof cartOrId === 'object' ? cartOrId?._id : cartOrId;
  if (!id) return null;

  let cart = await AbandonedCart.findById(id)
    .select('cartRestoreToken recoveryToken recoveryOfferTotal status items cartTotal currency storeId')
    .lean();

  if (!cart) return null;
  if (cart.cartRestoreToken) return cart;

  const cartRestoreToken = generateCartRestoreToken();
  cart = await AbandonedCart.findByIdAndUpdate(
    id,
    { $set: { cartRestoreToken } },
    { new: true },
  )
    .select('cartRestoreToken recoveryToken recoveryOfferTotal status items cartTotal currency storeId')
    .lean();

  return cart;
}

export async function findAbandonedCartByRestoreToken(token) {
  const cartRestoreToken = String(token || '').trim();
  if (!cartRestoreToken) return null;

  await connectDB();
  return AbandonedCart.findOne({
    cartRestoreToken,
    status: { $ne: 'converted' },
    deletedAt: { $in: [null, undefined] },
  }).lean();
}
