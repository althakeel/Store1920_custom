const DASHBOARD_KEY = 'store-dashboard-cache-v1';
const SELLER_KEY = 'store-seller-cache-v1';
const SELLER_TTL_MS = 10 * 60 * 1000;

let sellerMemory = null;

function readJson(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

function isFresh(entry, ttlMs) {
  if (!entry?.fetchedAt) return false;
  return Date.now() - entry.fetchedAt < ttlMs;
}

/** Dashboard stats must always come from the API — never hydrate from cache. */
export function readDashboardCache() {
  return null;
}

export function writeDashboardCache() {
  // no-op: dashboard metrics are always fetched live
}

export function clearDashboardCache() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DASHBOARD_KEY);
}

export function readSellerCache() {
  if (sellerMemory?.payload) return sellerMemory.payload;
  const entry = readJson(SELLER_KEY);
  if (entry?.payload && isFresh(entry, SELLER_TTL_MS)) {
    sellerMemory = entry;
    return entry.payload;
  }
  return null;
}

export function writeSellerCache(payload) {
  const entry = { payload, fetchedAt: Date.now() };
  sellerMemory = entry;
  writeJson(SELLER_KEY, entry);
}

export function clearStoreSessionCache() {
  sellerMemory = null;
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DASHBOARD_KEY);
  sessionStorage.removeItem(SELLER_KEY);

  const keysToRemove = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (key?.startsWith('store-page-cache:')) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => sessionStorage.removeItem(key));
}
