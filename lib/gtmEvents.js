/**
 * GTM / dataLayer event names — must match GTM Custom Event triggers exactly.
 */
export const GTM_EVENTS = Object.freeze({
  PAGE_VIEW: 'page_view',
  VIEW_ITEM: 'view_item',
  ADD_TO_CART: 'add_to_cart',
  REMOVE_FROM_CART: 'remove_from_cart',
  VIEW_CART: 'view cart',
  BEGIN_CHECKOUT: 'begin_checkout',
  /**
   * GA4 only — do not wire Meta Pixel to this event in GTM.
   * Meta InitiateCheckout is sent via direct fbq in the app (same pattern as ga4_purchase).
   */
  GA4_BEGIN_CHECKOUT: 'ga4_begin_checkout',
  /** GA4 only — do not wire Meta Pixel to this event in GTM (Meta uses direct fbq Purchase). */
  GA4_PURCHASE: 'ga4_purchase',
  /** @deprecated Prefer GA4_PURCHASE — legacy name that often double-fires Meta in GTM. */
  PURCHASE: 'purchase',
  SEARCH: 'search',
  SIGN_UP: 'sign_up',
});

/** Client-side GTM purchase fires only on this route. */
export const GTM_PURCHASE_PATH = '/order-success';

/** Funnel pages that fire a dedicated ecommerce event — skip extra page_view. */
export const GTM_SKIP_PAGE_VIEW_PATHS = [
  '/cart',
  '/checkout',
  '/order-success',
];

export function shouldSkipGtmPageView(pathname) {
  if (!pathname) return false;
  const path = pathname.split('?')[0];
  return GTM_SKIP_PAGE_VIEW_PATHS.some(
    (skip) => path === skip || path.startsWith(`${skip}/`),
  );
}

export function gtmDedupeKey(event, suffix) {
  return `gtm:${event}:${suffix}`;
}

/** GA4 / gtag event names (underscores) — mirrors dataLayer custom events for direct gtag calls. */
const GA4_EVENT_ALIASES = {
  [GTM_EVENTS.VIEW_CART]: 'view_cart',
};

export function toGa4EventName(gtmEvent) {
  return GA4_EVENT_ALIASES[gtmEvent] || String(gtmEvent || '').replace(/\s+/g, '_');
}
