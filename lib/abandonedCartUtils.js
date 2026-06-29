const PLACEHOLDER_NAMES = new Set([
  'unknown',
  'guest',
  'guest user',
  'customer',
  'user',
  'n/a',
  'na',
]);

import { sumAbandonedCartItemsTotal } from '@/lib/abandonedCartLineItems';

export function getAbandonedCartTotal(cart = {}) {
  const items = Array.isArray(cart.items) ? cart.items : [];
  if (items.length) {
    const computed = sumAbandonedCartItemsTotal(cart);
    if (computed > 0) return computed;
  }

  if (Number.isFinite(Number(cart.cartTotal)) && Number(cart.cartTotal) > 0) {
    return Number(cart.cartTotal);
  }

  return 0;
}

export function isPlaceholderName(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return PLACEHOLDER_NAMES.has(normalized);
}

export function hasAbandonedCartAddress(address) {
  if (!address || typeof address !== 'object') return false;

  return Boolean(
    address.street?.trim()
    || address.city?.trim()
    || address.district?.trim()
    || address.state?.trim()
    || address.country?.trim()
    || address.pincode?.trim()
    || address.zip?.trim()
  );
}

/** No email, phone, or address on this abandoned cart record */
export function isAnonymousAbandonedCart(cart = {}) {
  if (String(cart.email || '').trim()) return false;
  if (String(cart.phone || '').trim()) return false;
  if (hasAbandonedCartAddress(cart.address)) return false;
  return true;
}

export function resolveAbandonedCartName(cart = {}, userProfile = null) {
  const candidates = [
    cart.name,
    userProfile?.name,
    cart.email ? String(cart.email).split('@')[0] : null,
    userProfile?.email ? String(userProfile.email).split('@')[0] : null,
    cart.phone,
    userProfile?.phone,
  ];

  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (!text || isPlaceholderName(text)) continue;
    return text;
  }

  return 'Guest';
}

export function getAbandonedCartDisplayName(cart = {}) {
  if (cart.anonymousId && isAnonymousAbandonedCart(cart)) {
    return `Guest · ${String(cart.anonymousId).slice(0, 8)}`;
  }
  if (isAnonymousAbandonedCart(cart)) return 'Guest';

  const resolved = cart.resolvedCustomerName || cart.name;
  if (resolved?.trim() && !isPlaceholderName(resolved)) return resolved.trim();
  if (cart.email?.trim()) return cart.email.split('@')[0];
  if (cart.phone?.trim()) return cart.phone;

  return 'Guest';
}

export function enrichAbandonedCarts(carts = [], users = []) {
  const userMap = new Map();

  users.forEach((user) => {
    if (user?._id) userMap.set(String(user._id), user);
    if (user?.firebaseUid) userMap.set(String(user.firebaseUid), user);
  });

  const nameByIdentity = new Map();
  carts.forEach((cart) => {
    if (isAnonymousAbandonedCart(cart)) return;
    if (isPlaceholderName(cart?.name)) return;

    const keys = [
      cart.userId ? `uid:${cart.userId}` : null,
      cart.email ? `email:${String(cart.email).toLowerCase()}` : null,
      cart.phone ? `phone:${cart.phone}` : null,
    ].filter(Boolean);

    keys.forEach((key) => nameByIdentity.set(key, String(cart.name).trim()));
  });

  return carts.map((cart) => {
    if (isAnonymousAbandonedCart(cart)) {
      const guestLabel = cart.anonymousId
        ? `Guest · ${String(cart.anonymousId).slice(0, 8)}`
        : 'Guest';
      return {
        ...cart,
        name: guestLabel,
        resolvedCustomerName: guestLabel,
        isAnonymousGuest: true,
      };
    }

    const userProfile = cart.userId ? userMap.get(String(cart.userId)) : null;
    let resolvedName = resolveAbandonedCartName(cart, userProfile);

    const identityKeys = [
      cart.userId ? `uid:${cart.userId}` : null,
      cart.email ? `email:${String(cart.email).toLowerCase()}` : null,
      cart.phone ? `phone:${cart.phone}` : null,
    ].filter(Boolean);

    if (isPlaceholderName(resolvedName) || resolvedName === 'Guest') {
      for (const key of identityKeys) {
        const siblingName = nameByIdentity.get(key);
        if (siblingName && !isPlaceholderName(siblingName)) {
          resolvedName = siblingName;
          break;
        }
      }
    }

    if (isPlaceholderName(resolvedName)) {
      resolvedName = getAbandonedCartDisplayName({
        ...cart,
        resolvedCustomerName: resolvedName,
      });
    }

    return {
      ...cart,
      name: isPlaceholderName(cart.name) ? resolvedName : cart.name,
      resolvedCustomerName: resolvedName,
      isAnonymousGuest: false,
    };
  });
}
