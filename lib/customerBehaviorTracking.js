import crypto from 'crypto';
import Address from '@/models/Address';
import User from '@/models/User';

const isPresent = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '');

const hashValue = (value) => {
  if (!isPresent(value)) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex');
};

const shouldDebug = () => process.env.ENABLE_TRACKING_DEBUG === 'true';

const debugLog = (...args) => {
  if (shouldDebug()) {
    console.log('[customer-tracking]', ...args);
  }
};

const pickIdentityFromSource = (label, source) => {
  if (!source) {
    return {
      source: label,
      emailHash: null,
      phoneHash: null,
      hasAny: false,
    };
  }

  const email = normalizeEmail(source.email);
  const phone = normalizePhone(source.phone || source.mobile || source.contactNumber);

  return {
    source: label,
    emailHash: hashValue(email),
    phoneHash: hashValue(phone),
    hasAny: isPresent(email) || isPresent(phone),
  };
};

export async function resolveCustomerIdentity({
  firebaseUid,
  userId,
  email,
  phone,
  addressId,
  checkoutAddress,
  savedAddress,
}) {
  const resolvedFirebaseUid = isPresent(firebaseUid) ? String(firebaseUid).trim() : null;
  const resolvedUserId = isPresent(userId) ? String(userId).trim() : null;

  let resolvedSavedAddress = savedAddress || null;

  if (!resolvedSavedAddress && isPresent(addressId)) {
    resolvedSavedAddress = await Address.findById(String(addressId)).lean();
  }

  let userDoc = null;
  if ((resolvedFirebaseUid || resolvedUserId) && !savedAddress) {
    userDoc = await User.findOne({
      $or: [
        resolvedFirebaseUid ? { firebaseUid: resolvedFirebaseUid } : null,
        resolvedUserId ? { _id: resolvedUserId } : null,
      ].filter(Boolean),
    }).lean();
  }

  const explicitIdentity = pickIdentityFromSource('explicit_payload', { email, phone });
  const checkoutIdentity = pickIdentityFromSource('checkout_address', checkoutAddress);
  const savedIdentity = pickIdentityFromSource('saved_address', resolvedSavedAddress);
  const userIdentity = pickIdentityFromSource('user_profile', userDoc);

  const identityChain = [explicitIdentity, checkoutIdentity, savedIdentity, userIdentity];
  const picked = identityChain.find((entry) => entry.hasAny) || explicitIdentity;

  const identifier = {
    firebaseUid: resolvedFirebaseUid,
    userId: resolvedUserId,
    emailHash: picked.emailHash,
    phoneHash: picked.phoneHash,
    source: picked.source,
    fallbackNote: picked.source === 'explicit_payload'
      ? 'Direct identifiers from event payload'
      : `Fallback resolved from ${picked.source}`,
  };

  debugLog('identity-resolved', {
    firebaseUid: identifier.firebaseUid,
    userId: identifier.userId,
    source: identifier.source,
    hasEmailHash: Boolean(identifier.emailHash),
    hasPhoneHash: Boolean(identifier.phoneHash),
  });

  return identifier;
}

export function buildCustomerBehaviorEvent(payload, identifier) {
  return {
    storeId: String(payload.storeId || '').trim(),
    eventType: String(payload.eventType || '').trim(),
    identifier,
    context: {
      pageType: payload.pageType || null,
      pagePath: payload.pagePath || null,
      productId: payload.productId ? String(payload.productId) : null,
      quantity: Number(payload.quantity || 1),
      value: Number(payload.value || 0),
      currency: payload.currency || 'AED',
      sessionId: payload.sessionId || null,
      anonymousId: payload.anonymousId || null,
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
    },
  };
}

export function validateTrackingPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Invalid payload';
  }

  if (!isPresent(payload.storeId)) {
    return 'storeId is required';
  }

  if (!isPresent(payload.eventType)) {
    return 'eventType is required';
  }

  return null;
}

export function shouldDropForMissingIdentity(identifier) {
  if (!identifier) return true;

  return !(
    isPresent(identifier.firebaseUid) ||
    isPresent(identifier.userId) ||
    isPresent(identifier.emailHash) ||
    isPresent(identifier.phoneHash)
  );
}

export { shouldDebug, debugLog };
