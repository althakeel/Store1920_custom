'use client';

const FBCLID_STORAGE_KEY = 'meta_fbclid';

export function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function writeCookie(name, value, maxAgeSeconds = 90 * 24 * 60 * 60) {
  if (typeof document === 'undefined' || !value) return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

export function getFbclidFromLocation(search = '') {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(search || window.location.search);
    return params.get('fbclid') || null;
  } catch {
    return null;
  }
}

export function buildFbcValue(fbclid, createdAtMs = Date.now()) {
  const id = String(fbclid || '').trim();
  if (!id) return null;
  return `fb.1.${createdAtMs}.${id}`;
}

/** Ensure _fbc exists when the visitor arrives from a Meta ad (fbclid in URL). */
export function ensureMetaClickId(search) {
  if (typeof window === 'undefined') return null;

  const existing = readCookie('_fbc');
  if (existing) return existing;

  let fbclid = getFbclidFromLocation(search);
  if (!fbclid) {
    try {
      fbclid = localStorage.getItem(FBCLID_STORAGE_KEY);
    } catch {
      fbclid = null;
    }
  }

  if (!fbclid) return null;

  try {
    localStorage.setItem(FBCLID_STORAGE_KEY, fbclid);
  } catch {
    // Ignore storage failures.
  }

  const fbc = buildFbcValue(fbclid);
  if (fbc) writeCookie('_fbc', fbc);
  return fbc;
}

export function getMetaBrowserCookies() {
  if (typeof window === 'undefined') return { fbp: null, fbc: null };

  ensureMetaClickId();

  return {
    fbp: readCookie('_fbp'),
    fbc: readCookie('_fbc'),
  };
}

export function getMetaAttributionPayload() {
  if (typeof window === 'undefined') return {};

  const fromWindow = window.attributionData || {};
  let utm = {};

  try {
    const raw = localStorage.getItem('utm_data');
    if (raw) {
      const parsed = JSON.parse(raw);
      utm = {
        utm_source: parsed.source || undefined,
        utm_medium: parsed.medium || undefined,
        utm_campaign: parsed.campaign || undefined,
        utm_content: parsed.content || undefined,
        utm_term: parsed.term || undefined,
        utm_id: parsed.id || undefined,
        referrer: parsed.referrer || undefined,
      };
    }
  } catch {
    // Ignore malformed utm_data.
  }

  const fbclid = getFbclidFromLocation();
  if (fbclid && !utm.utm_source) {
    utm.utm_source = 'facebook';
    utm.utm_medium = utm.utm_medium || 'paid';
  }

  const fbCookies = getMetaBrowserCookies();

  return {
    ...utm,
    ...fromWindow,
    entry_page_url: fromWindow.entry_page_url || window.location.href,
    ...(fbCookies.fbp ? { fbp: fbCookies.fbp } : {}),
    ...(fbCookies.fbc ? { fbc: fbCookies.fbc } : {}),
  };
}

export function whenFbqReady(callback, maxMs = 10000) {
  if (typeof window === 'undefined') return () => {};

  const run = () => {
    if (typeof window.fbq === 'function') {
      callback(window.fbq);
      return true;
    }
    return false;
  };

  if (run()) return () => {};

  const started = Date.now();
  const timer = window.setInterval(() => {
    if (run() || Date.now() - started >= maxMs) {
      window.clearInterval(timer);
    }
  }, 50);

  return () => window.clearInterval(timer);
}
