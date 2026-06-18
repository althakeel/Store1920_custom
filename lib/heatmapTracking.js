'use client';

import {
  getOrCreateAnonymousId,
  getOrCreateSessionId,
  getPageType,
  getTrackingStoreId,
} from '@/lib/trackingClient';

const BATCH_LIMIT = 20;
const FLUSH_INTERVAL_MS = 8000;
const MIN_CLICK_GAP_MS = 120;

let clickBuffer = [];
let flushTimer = null;
let lastClickAt = 0;

const SKIP_PATH_PREFIXES = ['/store', '/admin', '/dashboard'];

function shouldSkipPath(pathname = '') {
  const path = String(pathname || '');
  return SKIP_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isSensitiveElement(target) {
  if (!target || !(target instanceof Element)) return true;

  const el = target.closest('input, textarea, select, [contenteditable="true"], [data-no-heatmap]');
  if (!el) return false;

  if (el instanceof HTMLInputElement) {
    const type = String(el.type || '').toLowerCase();
    if (['password', 'email', 'tel', 'number'].includes(type)) return true;
    if (el.autocomplete?.includes('cc-')) return true;
  }

  return Boolean(el.closest('[data-no-heatmap]'));
}

function getElementLabel(target) {
  if (!target || !(target instanceof Element)) return '';

  const el = target.closest('a, button, [role="button"], input, label, h1, h2, h3, h4, p, img') || target;
  const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 80);

  if (el instanceof HTMLImageElement && el.alt) return el.alt.slice(0, 80);
  if (el instanceof HTMLInputElement && el.value) return el.value.slice(0, 80);

  return '';
}

function buildClickPayload(event, pathname) {
  const viewportWidth = window.innerWidth || 1;
  const viewportHeight = window.innerHeight || 1;
  const clientX = event.clientX;
  const clientY = event.clientY;

  const target = event.target;
  const element = target instanceof Element ? target.closest('[id],[class],[href],button,a,input') || target : null;

  return {
    pagePath: pathname,
    pageType: getPageType(pathname),
    clientX,
    clientY,
    pageX: event.pageX,
    pageY: event.pageY,
    viewportWidth,
    viewportHeight,
    scrollX: window.scrollX || 0,
    scrollY: window.scrollY || 0,
    xPct: Number(((clientX / viewportWidth) * 100).toFixed(2)),
    yPct: Number(((clientY / viewportHeight) * 100).toFixed(2)),
    elementTag: element?.tagName || 'UNKNOWN',
    elementId: element?.id ? String(element.id).slice(0, 80) : '',
    elementClass: element?.className ? String(element.className).slice(0, 120) : '',
    elementText: getElementLabel(target),
  };
}

async function flushHeatmapClicks() {
  if (!clickBuffer.length) return;

  const batch = clickBuffer.splice(0, BATCH_LIMIT);
  const storeId = await getTrackingStoreId();
  if (!storeId) {
    clickBuffer = [...batch, ...clickBuffer].slice(0, BATCH_LIMIT * 3);
    return;
  }

  const payload = {
    storeId,
    anonymousId: getOrCreateAnonymousId(),
    sessionId: getOrCreateSessionId(),
    clicks: batch,
  };

  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/analytics/heatmap-clicks', blob);
      if (sent) return;
    }

    await fetch('/api/analytics/heatmap-clicks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body,
    });
  } catch {
    clickBuffer = [...batch, ...clickBuffer].slice(0, BATCH_LIMIT * 3);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushHeatmapClicks();
  }, FLUSH_INTERVAL_MS);
}

export function queueHeatmapClick(event, pathname = '') {
  if (!event || shouldSkipPath(pathname)) return;
  if (isSensitiveElement(event.target)) return;

  const now = Date.now();
  if (now - lastClickAt < MIN_CLICK_GAP_MS) return;
  lastClickAt = now;

  clickBuffer.push(buildClickPayload(event, pathname));
  if (clickBuffer.length >= BATCH_LIMIT) {
    flushHeatmapClicks();
    return;
  }
  scheduleFlush();
}

export function flushHeatmapClicksNow() {
  if (flushTimer) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  return flushHeatmapClicks();
}
