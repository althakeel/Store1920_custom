export function resolveCheckoutOrigin(request) {
  const headerOrigin = request?.headers?.get?.('origin');
  if (headerOrigin && /^https?:\/\//i.test(headerOrigin)) {
    return headerOrigin.replace(/\/+$/, '');
  }

  for (const value of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_BASE_URL]) {
    if (value && /^https?:\/\//i.test(String(value))) {
      return String(value).replace(/\/+$/, '');
    }
  }

  const host = request?.headers?.get?.('x-forwarded-host') || request?.headers?.get?.('host');
  if (host) {
    const proto = request?.headers?.get?.('x-forwarded-proto') || 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  return 'https://store1920.com';
}

/** Tamara redirect/webhook URLs must use the canonical public store domain. */
export function resolveTamaraMerchantBaseUrl(request) {
  for (const value of [
    process.env.TAMARA_MERCHANT_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
  ]) {
    const trimmed = String(value || '').trim().replace(/\/+$/, '');
    if (trimmed && /^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
  }

  return resolveCheckoutOrigin(request);
}

export function buildCheckoutRedirectUrl(baseUrl, pathname, query = {}) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!base || !/^https?:\/\//i.test(base)) {
    throw new Error('Checkout base URL is missing or invalid');
  }

  const normalizedPath = String(pathname || '').trim();
  const url = new URL(
    normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`,
    `${base}/`,
  );

  Object.entries(query).forEach(([key, value]) => {
    if (value != null && String(value).trim() !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  if (!url.pathname || url.pathname === '/') {
    throw new Error(`Checkout redirect URL is missing a path: ${url.toString()}`);
  }

  return url.toString();
}
