"use client";

import { hasTrackedOnce, markTrackedOnce } from '@/lib/trackingDedupe';
import { META_PIXEL_ID } from '@/lib/metaPixelConfig';

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

function sendMetaEventNow(eventName, params = {}, options = {}) {
  if (typeof window === 'undefined' || !window.fbq || !eventName) return false;

  const dedupeKey = resolveMetaDedupeKey(eventName, options);
  if (!options.force && dedupeKey && hasTrackedOnce(dedupeKey)) {
    return false;
  }

  try {
    const payload = {
      ...params,
      ...getAttributionData(),
    };

    if (options?.eventID) {
      // trackSingle avoids duplicate Purchase when GTM also loaded the same pixel ID.
      window.fbq('trackSingle', META_PIXEL_ID, eventName, payload, { eventID: options.eventID });
    } else if (eventName === 'Purchase') {
      window.fbq('trackSingle', META_PIXEL_ID, eventName, payload);
    } else {
      window.fbq('track', eventName, payload);
    }

    if (dedupeKey) {
      markTrackedOnce(dedupeKey);
      FBQ_QUEUED_KEYS.delete(dedupeKey);
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
    if (window.fbq) {
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

  const dedupeKey = resolveMetaDedupeKey(eventName, options);
  if (dedupeKey && (hasTrackedOnce(dedupeKey) || FBQ_QUEUED_KEYS.has(dedupeKey))) {
    return false;
  }

  if (!window.fbq) {
    if (dedupeKey) {
      FBQ_QUEUED_KEYS.add(dedupeKey);
    }
    FBQ_QUEUE.push({ eventName, params, options });
    scheduleFbqDrain();
    return true;
  }

  return sendMetaEventNow(eventName, params, options);
};
