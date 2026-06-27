const DEFAULT_APP_URL = 'https://store1920.com';

export function getAppBaseUrl() {
  return String(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      DEFAULT_APP_URL
  ).replace(/\/+$/, '');
}

/** Customer-facing storefront URL for emails and deep links (avoids staging .store domain). */
export function getCustomerSiteUrl() {
  const explicit = String(
    process.env.CUSTOMER_FACING_URL ||
      process.env.NEXT_PUBLIC_CUSTOMER_URL ||
      '',
  ).trim();
  if (explicit && /^https?:\/\//i.test(explicit)) {
    return explicit.replace(/\/+$/, '');
  }

  const base = getAppBaseUrl();
  try {
    const { hostname } = new URL(base);
    if (hostname === 'store1920.store' || hostname === 'www.store1920.store') {
      return DEFAULT_APP_URL;
    }
  } catch {
    // fall through
  }

  return base || DEFAULT_APP_URL;
}

export function buildCustomerSitePath(pathname = '/') {
  const base = getCustomerSiteUrl();
  const path = String(pathname || '/').trim();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
