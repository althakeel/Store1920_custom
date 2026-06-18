const memory = new Map();

function storageKey(key) {
  return `store-page-cache:${key}`;
}

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

export function readPageCache(key, ttlMs = 5 * 60 * 1000) {
  const mem = memory.get(key);
  if (mem?.data && isFresh(mem, ttlMs)) return mem.data;

  const entry = readJson(storageKey(key));
  if (entry?.data && isFresh(entry, ttlMs)) {
    memory.set(key, entry);
    return entry.data;
  }
  return null;
}

export function writePageCache(key, data) {
  const entry = { data, fetchedAt: Date.now() };
  memory.set(key, entry);
  writeJson(storageKey(key), entry);
}

export function clearPageCache(key) {
  memory.delete(key);
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(storageKey(key));
}
