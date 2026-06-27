import { isManualStoreDashboardOrder } from '@/lib/storeCreateOrder';

const PLATFORM_RULES = [
  { key: 'INSTAGRAM', pattern: /instagram|^ig$|^insta$/i, label: 'Instagram', className: 'bg-pink-50 text-pink-700' },
  { key: 'FACEBOOK', pattern: /facebook|^fb$|^meta$/i, label: 'Facebook', className: 'bg-blue-50 text-blue-700' },
  { key: 'TIKTOK', pattern: /tiktok|^tt$/i, label: 'TikTok', className: 'bg-slate-900 text-white' },
  { key: 'GOOGLE', pattern: /google|gclid/i, label: 'Google', className: 'bg-emerald-50 text-emerald-700' },
  { key: 'YOUTUBE', pattern: /youtube|^yt$/i, label: 'YouTube', className: 'bg-red-50 text-red-700' },
  { key: 'SNAPCHAT', pattern: /snapchat|^snap$/i, label: 'Snapchat', className: 'bg-yellow-50 text-yellow-800' },
  { key: 'PINTEREST', pattern: /pinterest/i, label: 'Pinterest', className: 'bg-rose-50 text-rose-700' },
  { key: 'LINKEDIN', pattern: /linkedin/i, label: 'LinkedIn', className: 'bg-sky-50 text-sky-700' },
  { key: 'WHATSAPP', pattern: /whatsapp|^wa$/i, label: 'WhatsApp', className: 'bg-green-50 text-green-700' },
  { key: 'X', pattern: /twitter|^x$/i, label: 'X', className: 'bg-slate-100 text-slate-800' },
  { key: 'EMAIL', pattern: /email|newsletter|mail/i, label: 'Email', className: 'bg-violet-50 text-violet-700' },
  { key: 'SMS', pattern: /sms|text/i, label: 'SMS', className: 'bg-teal-50 text-teal-700' },
];

export const TRAFFIC_SOURCE_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All sources' },
  { value: 'DIRECT', label: 'Direct' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'GOOGLE', label: 'Google' },
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'STORE_DASHBOARD', label: 'Store dashboard' },
  { value: 'OTHER', label: 'Other' },
];

function normalizeToken(value) {
  return String(value || '').trim();
}

function isMeaningfulToken(value) {
  const token = normalizeToken(value).toLowerCase();
  return Boolean(token) && !['none', 'null', 'undefined', 'direct', '(none)', 'n/a'].includes(token);
}

function titleCase(value) {
  const text = normalizeToken(value);
  if (!text) return '';
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function matchPlatform(...values) {
  const combined = values
    .map((value) => normalizeToken(value).toLowerCase())
    .filter(Boolean)
    .join(' ');

  if (!combined) return null;

  for (const rule of PLATFORM_RULES) {
    if (rule.pattern.test(combined)) {
      return rule;
    }
  }

  return null;
}

function inferPlatformFromReferrer(referrer = '') {
  const value = normalizeToken(referrer).toLowerCase();
  if (!value || value === 'direct') return null;

  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return matchPlatform(hostname);
  } catch {
    return matchPlatform(value);
  }
}

function buildAttributionTitle(attribution = {}) {
  const lines = [
    ['Source', attribution.utmSource],
    ['Medium', attribution.utmMedium],
    ['Campaign', attribution.utmCampaign],
    ['Content', attribution.utmContent],
    ['Term', attribution.utmTerm],
    ['Referrer', attribution.utmReferrer],
  ]
    .filter(([, value]) => isMeaningfulToken(value))
    .map(([label, value]) => `${label}: ${normalizeToken(value)}`);

  return lines.join('\n');
}

function resolveOrderTrafficSourceMeta(order = {}) {
  if (isManualStoreDashboardOrder(order)) {
    return {
      key: 'STORE_DASHBOARD',
      label: 'Store dashboard',
      detail: 'Manual order',
      className: 'bg-indigo-50 text-indigo-700',
      title: 'Created manually from the store dashboard',
    };
  }

  const attribution = order?.attribution && typeof order.attribution === 'object'
    ? order.attribution
    : {};

  const source = normalizeToken(attribution.utmSource);
  const medium = normalizeToken(attribution.utmMedium);
  const campaign = normalizeToken(attribution.utmCampaign);
  const referrer = normalizeToken(attribution.utmReferrer);

  const platform = matchPlatform(source, medium, campaign)
    || inferPlatformFromReferrer(referrer);

  const hasAttribution = [source, medium, campaign, referrer].some(isMeaningfulToken);

  if (!hasAttribution) {
    return {
      key: 'DIRECT',
      label: 'Direct',
      detail: null,
      className: 'bg-slate-100 text-slate-600',
      title: 'No UTM parameters or referrer were captured for this order',
    };
  }

  const label = platform?.label
    || (isMeaningfulToken(source) ? titleCase(source) : null)
    || (isMeaningfulToken(medium) ? titleCase(medium) : null)
    || 'Other';

  const detailParts = [];
  if (isMeaningfulToken(source) && titleCase(source) !== label) {
    detailParts.push(`source: ${source}`);
  } else if (isMeaningfulToken(medium) && medium.toLowerCase() !== 'none') {
    detailParts.push(medium);
  }
  if (isMeaningfulToken(campaign) && campaign.toLowerCase() !== 'none') {
    detailParts.push(campaign);
  }

  return {
    key: platform?.key || 'OTHER',
    label,
    detail: detailParts.slice(0, 2).join(' · ') || null,
    className: platform?.className || 'bg-violet-50 text-violet-700',
    title: buildAttributionTitle(attribution) || label,
  };
}

/** Stable filter key for store orders dashboard (instagram, facebook, direct, etc.). */
export function getOrderTrafficSourceKey(order = {}) {
  return resolveOrderTrafficSourceMeta(order).key;
}

/**
 * Store dashboard display for where an order came from (UTM / referrer / social).
 */
export function getOrderTrafficSourceDisplay(order = {}) {
  const meta = resolveOrderTrafficSourceMeta(order);
  return {
    label: meta.label,
    detail: meta.detail,
    className: meta.className,
    title: meta.title,
  };
}
