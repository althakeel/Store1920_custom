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
  fn();
  markTrackedOnce(key);
  return true;
}
