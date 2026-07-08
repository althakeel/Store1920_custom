"use client";
import { useEffect } from "react";
import { whenFbqReady } from "@/lib/metaBrowserAttribution";
import { META_PIXEL_ID } from "@/lib/metaPixelConfig";

/**
 * Ads Attribution Tracker
 * Captures ad source data and adds it to all pixel events
 * Tracks: ViewContent, AddToCart, InitiateCheckout, Purchase
 */
export default function AdsAttribution() {
  useEffect(() => {
    let utmData = null;
    try {
      const raw = localStorage.getItem('utm_data');
      utmData = raw ? JSON.parse(raw) : null;
    } catch {
      utmData = null;
    }

    if (!utmData) return;

    window.attributionData = {
      utm_source: utmData.source,
      utm_medium: utmData.medium,
      utm_campaign: utmData.campaign,
      utm_id: utmData.id,
      referrer: utmData.referrer,
      entry_page_url: window.location.href,
    };

    whenFbqReady((fbq) => {
      fbq('trackSingleCustom', META_PIXEL_ID, 'AdsAttribution', {
        utm_source: utmData.source,
        utm_campaign: utmData.campaign,
        utm_medium: utmData.medium,
      });
    });

    fetch('/api/analytics/track-attribution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: utmData.source,
        medium: utmData.medium,
        campaign: utmData.campaign,
        referrer: utmData.referrer,
        timestamp: new Date().toISOString(),
      }),
    }).catch((err) => console.error('Attribution tracking failed:', err));
  }, []);

  return null;
}
