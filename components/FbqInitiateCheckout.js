"use client";
import { useEffect } from "react";
import { trackInitiateCheckout } from "@/lib/metaPixelTracking";

export default function FbqInitiateCheckout({ value = 0, currency = 'AED', contentIds = [], numItems = 0 }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ids = Array.isArray(contentIds) ? contentIds.filter(Boolean).map(String) : [];
    if (ids.length === 0) return;

    const eventSignature = `${ids.join(',')}_${Number(value || 0)}_${Number(numItems || 0)}`;
    const eventKey = `meta_initiate_checkout_${eventSignature}`;
    if (sessionStorage.getItem(eventKey)) return;

    trackInitiateCheckout({
      value,
      currency,
      contentIds: ids,
      numItems,
    });

    sessionStorage.setItem(eventKey, '1');
  }, [value, currency, numItems, contentIds]);

  return null;
}
