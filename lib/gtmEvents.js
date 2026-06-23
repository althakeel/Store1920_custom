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
