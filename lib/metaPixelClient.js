"use client";

import { hasTrackedOnce, markTrackedOnce, markTrackedPersistently, hasTrackedPersistently } from '@/lib/trackingDedupe';
import { META_PIXEL_ID } from '@/lib/metaPixelConfig';
import { authorizeMetaPurchase, installMetaPurchaseGuard } from '@/lib/metaPurchaseGuard';

installMetaPurchaseGuard();

const FBQ_QUEUE = [];
const FBQ_QUEUED_KEYS = new Set();
let fbqDrainTimer = null;
const FBQ_DRAIN_TIMEOUT_MS = 10000;

export const getAttributionData = () => {
  if (typeof window === 'undefined') return {};
  return window.attributionData || {};
};

export const normalizeMetaError = (error) => {
  if (!error) return 'Unknown Meta Pixel error';
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    return error.message || error.error || error.detail || JSON.stringify(error);
  }
  return String(error);
};

function resolveMetaDedupeKey(eventName, options = {}) {
  if (options?.eventID) {
    return `meta:${eventName}:${options.eventID}`;
  }
  return options?.dedupeKey || null;
}

function getBareFbq() {
  if (typeof window === 'undefined') return null;
  const fbq = window.fbq;
  return typeof fbq === 'function' ? fbq : null;
}

function invokeBareFbq(...args) {
  const bareFbq = getBareFbq();
  if (!bareFbq || typeof bareFbq !== 'function') return false;

  try {
    bareFbq(...args);
    return true;
  } catch (error) {
    console.warn('[MetaPixel] fbq call failed:', normalizeMetaError(error));
    return false;
  }
}

function sendTrackSingleViaBareFbq(eventName, payload, options = {}) {
  if (options?.eventID) {
    return invokeBareFbq('trackSingle', META_PIXEL_ID, eventName, payload, { eventID: options.eventID });
  }
  return invokeBareFbq('trackSingle', META_PIXEL_ID, eventName, payload);
}

function sendPurchaseViaBareFbq(payload, options = {}) {
  if (!options?.eventID) return false;
  authorizeMetaPurchase(options.eventID);
  return sendTrackSingleViaBareFbq('Purchase', payload, options);
}

const META_FUNNEL_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'ViewCart',
  'Purchase',
]);

function sendMetaEventNow(eventName, params = {}, options = {}) {
  if (typeof window === 'undefined' || !eventName) return false;
  if (!getBareFbq()) return false;

  const isPurchase = eventName === 'Purchase' && options?.eventID;
  const purchasePersistKey = isPurchase
    ? `meta:Purchase:${options.eventID}`
    : null;

  if (isPurchase && hasTrackedPersistently(purchasePersistKey)) {
    return false;
  }

  const dedupeKey = resolveMetaDedupeKey(eventName, options);
  if (!isPurchase && !options.force && dedupeKey && hasTrackedOnce(dedupeKey)) {
    return false;
  }

  try {
    const payload = {
      ...params,
      ...getAttributionData(),
    };

    let sent = false;

    if (eventName === 'Purchase' && options?.eventID) {
      sent = sendPurchaseViaBareFbq(payload, options);
    } else if (META_FUNNEL_EVENTS.has(eventName)) {
      sent = sendTrackSingleViaBareFbq(eventName, payload, options);
    } else if (options?.eventID) {
      sent = sendTrackSingleViaBareFbq(eventName, payload, options);
    } else {
      sent = invokeBareFbq('track', eventName, payload);
    }

    if (!sent) return false;

    if (dedupeKey && !isPurchase) {
      markTrackedOnce(dedupeKey);
      FBQ_QUEUED_KEYS.delete(dedupeKey);
    }

    if (isPurchase) {
      markTrackedPersistently(purchasePersistKey);
    }

    return true;
  } catch (error) {
    console.warn('[MetaPixel] track error:', normalizeMetaError(error));
    return false;
  }
}

function scheduleFbqDrain() {
  if (typeof window === 'undefined' || fbqDrainTimer) return;

  const started = Date.now();

  const drain = () => {
    if (getBareFbq()) {
      fbqDrainTimer = null;
      const pending = FBQ_QUEUE.splice(0, FBQ_QUEUE.length);
      pending.forEach(({ eventName, params, options }) => {
        sendMetaEventNow(eventName, params, { ...options, force: true });
      });
      return;
    }

    if (Date.now() - started >= FBQ_DRAIN_TIMEOUT_MS) {
      fbqDrainTimer = null;
      if (FBQ_QUEUE.length > 0) {
        scheduleFbqDrain();
      }
      return;
    }

    fbqDrainTimer = window.setTimeout(drain, 100);
  };

  drain();
}

export const trackMetaEvent = (eventName, params = {}, options = {}) => {
  if (typeof window === 'undefined' || !eventName) return false;

  const isPurchase = eventName === 'Purchase' && options?.eventID;
  const purchasePersistKey = isPurchase
    ? `meta:Purchase:${options.eventID}`
    : null;

  if (isPurchase && hasTrackedPersistently(purchasePersistKey)) {
    return false;
  }

  const dedupeKey = resolveMetaDedupeKey(eventName, options);
  if (!isPurchase && dedupeKey && (hasTrackedOnce(dedupeKey) || FBQ_QUEUED_KEYS.has(dedupeKey))) {
    return false;
  }

  if (isPurchase && dedupeKey && FBQ_QUEUED_KEYS.has(dedupeKey)) {
    return false;
  }

  if (eventName === 'Purchase' && options?.eventID) {
    authorizeMetaPurchase(options.eventID);
  }

  if (!getBareFbq()) {
    if (isPurchase && purchasePersistKey) {
      markTrackedPersistently(purchasePersistKey);
    }
    if (dedupeKey) {
      FBQ_QUEUED_KEYS.add(dedupeKey);
    }
    FBQ_QUEUE.push({ eventName, params, options });
    scheduleFbqDrain();
    return true;
  }

  return sendMetaEventNow(eventName, params, options);
};
