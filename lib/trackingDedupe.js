const MEMORY = new Set();

function storageKey(key) {
  return `track_once:${key}`;
}

export function hasTrackedOnce(key) {
  if (!key || typeof window === 'undefined') return false;
  if (MEMORY.has(key)) return true;
  try {
    return sessionStorage.getItem(storageKey(key)) === '1';
  } catch {
    return MEMORY.has(key);
  }
}

export function markTrackedOnce(key) {
  if (!key || typeof window === 'undefined') return;
  MEMORY.add(key);
  try {
    sessionStorage.setItem(storageKey(key), '1');
  } catch {
    // Ignore storage failures; in-memory dedupe still applies this session.
  }
}

export function runTrackedOnce(key, fn) {
  if (!key || hasTrackedOnce(key)) return false;
  try {
    if (fn() === false) return false;
  } catch {
    return false;
  }
  markTrackedOnce(key);
  return true;
}

function persistentStorageKey(key) {
  return `track_persist:${key}`;
}

/** Survives tab close — used for Meta Purchase (must fire exactly once per order). */
export function hasTrackedPersistently(key) {
  if (!key || typeof window === 'undefined') return false;
  if (MEMORY.has(`persist:${key}`)) return true;
  try {
    return localStorage.getItem(persistentStorageKey(key)) === '1';
  } catch {
    return MEMORY.has(`persist:${key}`);
  }
}

export function markTrackedPersistently(key) {
  if (!key || typeof window === 'undefined') return;
  MEMORY.add(`persist:${key}`);
  try {
    localStorage.setItem(persistentStorageKey(key), '1');
  } catch {
    // Ignore storage failures; in-memory guard still applies this session.
  }
}

const PURCHASE_IN_FLIGHT = new Set();

/** Prevents parallel Purchase sends before persistent dedupe is written. */
export function claimPurchaseInFlight(key) {
  if (!key || typeof window === 'undefined') return false;
  if (hasTrackedPersistently(key)) return false;
  if (PURCHASE_IN_FLIGHT.has(key)) return false;
  PURCHASE_IN_FLIGHT.add(key);
  return true;
}

export function releasePurchaseInFlight(key) {
  if (!key || typeof window === 'undefined') return;
  PURCHASE_IN_FLIGHT.delete(key);
}
