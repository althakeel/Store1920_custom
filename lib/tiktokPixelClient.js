'use client';

import { hasTrackedOnce, markTrackedOnce, markTrackedPersistently, hasTrackedPersistently } from '@/lib/trackingDedupe';

const TTQ_QUEUE = [];
const TTQ_QUEUED_KEYS = new Set();
let ttqDrainTimer = null;
const TTQ_DRAIN_TIMEOUT_MS = 10000;

function getTtq() {
  if (typeof window === 'undefined') return null;
  const ttq = window.ttq;
  return ttq && typeof ttq.track === 'function' ? ttq : null;
}

function invokeTtq(method, ...args) {
  const ttq = getTtq();
  if (!ttq) return false;

  try {
    if (method === 'page' && typeof ttq.page === 'function') {
      ttq.page(...args);
      return true;
    }
    if (method === 'track' && typeof ttq.track === 'function') {
      ttq.track(...args);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('[TikTokPixel] ttq call failed:', error);
    return false;
  }
}

function scheduleTtqDrain() {
  if (typeof window === 'undefined' || ttqDrainTimer) return;

  const started = Date.now();

  const drain = () => {
    if (getTtq()) {
      ttqDrainTimer = null;
      const pending = TTQ_QUEUE.splice(0, TTQ_QUEUE.length);
      pending.forEach(({ method, args }) => {
        invokeTtq(method, ...args);
      });
      return;
    }

    if (Date.now() - started >= TTQ_DRAIN_TIMEOUT_MS) {
      ttqDrainTimer = null;
      if (TTQ_QUEUE.length > 0) {
        scheduleTtqDrain();
      }
      return;
    }

    ttqDrainTimer = window.setTimeout(drain, 100);
  };

  drain();
}

export function trackTtqEvent(eventName, payload = {}, options = {}) {
  if (typeof window === 'undefined' || !eventName) return false;

  const isPurchase = eventName === 'CompletePayment' && options?.eventID;
  const purchasePersistKey = isPurchase
    ? `tiktok:CompletePayment:${options.eventID}`
    : null;

  if (isPurchase && hasTrackedPersistently(purchasePersistKey)) {
    return false;
  }

  const dedupeKey = options?.dedupeKey
    || (options?.eventID ? `tiktok:${eventName}:${options.eventID}` : null);

  if (!isPurchase && dedupeKey && (hasTrackedOnce(dedupeKey) || TTQ_QUEUED_KEYS.has(dedupeKey))) {
    return false;
  }

  if (isPurchase && dedupeKey && TTQ_QUEUED_KEYS.has(dedupeKey)) {
    return false;
  }

  const args = options?.eventID
    ? [eventName, payload, { event_id: options.eventID }]
    : [eventName, payload];

  if (!getTtq()) {
    if (dedupeKey) {
      TTQ_QUEUED_KEYS.add(dedupeKey);
    }
    TTQ_QUEUE.push({ method: 'track', args });
    scheduleTtqDrain();
    return true;
  }

  const sent = invokeTtq('track', ...args);
  if (!sent) return false;

  if (dedupeKey && !isPurchase) {
    markTrackedOnce(dedupeKey);
    TTQ_QUEUED_KEYS.delete(dedupeKey);
  }

  if (isPurchase && purchasePersistKey) {
    markTrackedPersistently(purchasePersistKey);
  }

  return true;
}

export function trackTtqPage() {
  if (typeof window === 'undefined') return false;
  if (!getTtq()) {
    TTQ_QUEUE.push({ method: 'page', args: [] });
    scheduleTtqDrain();
    return true;
  }
  return invokeTtq('page');
}

export function waitForTtq(maxMs = 10000) {
  return new Promise((resolve) => {
    if (getTtq()) {
      resolve(true);
      return;
    }

    const started = Date.now();
    const timer = window.setInterval(() => {
      if (getTtq()) {
        window.clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - started >= maxMs) {
        window.clearInterval(timer);
        resolve(false);
      }
    }, 50);
  });
}
