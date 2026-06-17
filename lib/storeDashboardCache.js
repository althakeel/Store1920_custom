const DASHBOARD_KEY = 'store-dashboard-cache-v1';
const SELLER_KEY = 'store-seller-cache-v1';
const DASHBOARD_TTL_MS = 5 * 60 * 1000;
const SELLER_TTL_MS = 10 * 60 * 1000;

let dashboardMemory = null;
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

export function readDashboardCache() {
  if (dashboardMemory?.data) return dashboardMemory.data;
  const entry = readJson(DASHBOARD_KEY);
  if (entry?.data && isFresh(entry, DASHBOARD_TTL_MS)) {
    dashboardMemory = entry;
    return entry.data;
  }
  return null;
}

export function writeDashboardCache(data) {
  const entry = { data, fetchedAt: Date.now() };
  dashboardMemory = entry;
  writeJson(DASHBOARD_KEY, entry);
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
  dashboardMemory = null;
  sellerMemory = null;
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DASHBOARD_KEY);
  sessionStorage.removeItem(SELLER_KEY);
}
