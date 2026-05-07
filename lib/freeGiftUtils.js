export const FREE_GIFT_PREFIX = 'gift:';

export function getCartEntryQuantity(entry) {
  if (typeof entry === 'number') return entry;
  return Number(entry?.quantity || 0);
}

export function isFreeGiftEntry(entry) {
  return Boolean(entry && typeof entry === 'object' && entry.freeGift?.giftProductId);
}

export function getCartEntryProductId(cartKey, entry) {
  if (isFreeGiftEntry(entry)) {
    return String(entry.freeGift.giftProductId || '');
  }
  return String(cartKey || '');
}

export function buildFreeGiftCartKey(campaignId, productId) {
  return `${FREE_GIFT_PREFIX}${String(campaignId || '').trim()}:${String(productId || '').trim()}`;
}

export function isFreeGiftCartKey(cartKey) {
  return String(cartKey || '').startsWith(FREE_GIFT_PREFIX);
}

export function getActiveDateStatus(campaign, now = new Date()) {
  const startsAt = campaign?.startsAt ? new Date(campaign.startsAt) : null;
  const endsAt = campaign?.endsAt ? new Date(campaign.endsAt) : null;

  if (startsAt && Number.isFinite(startsAt.getTime()) && startsAt > now) return false;
  if (endsAt && Number.isFinite(endsAt.getTime()) && endsAt < now) return false;
  return true;
}

export function campaignMatchesCart(campaign, cartProductIds = [], subtotal = 0, now = new Date()) {
  if (!campaign?.isActive) return false;
  if (!getActiveDateStatus(campaign, now)) return false;
  if (Number(subtotal || 0) < Number(campaign.minOrderAmount || 0)) return false;

  if (campaign.triggerMode === 'specific_products') {
    const triggerIds = Array.isArray(campaign.triggerProductIds)
      ? campaign.triggerProductIds.map((id) => String(id))
      : [];
    if (!triggerIds.length) return false;
    return triggerIds.some((id) => cartProductIds.includes(id));
  }

  return true;
}

export function selectBestEligibleCampaign(campaigns = [], cartProductIds = [], subtotal = 0, now = new Date()) {
  const eligible = campaigns.filter((campaign) => campaignMatchesCart(campaign, cartProductIds, subtotal, now));
  if (!eligible.length) return null;

  eligible.sort((left, right) => {
    const leftSpecific = left.triggerMode === 'specific_products' ? 1 : 0;
    const rightSpecific = right.triggerMode === 'specific_products' ? 1 : 0;
    if (leftSpecific !== rightSpecific) return rightSpecific - leftSpecific;

    const leftMin = Number(left.minOrderAmount || 0);
    const rightMin = Number(right.minOrderAmount || 0);
    if (leftMin !== rightMin) return rightMin - leftMin;

    return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
  });

  return eligible[0] || null;
}