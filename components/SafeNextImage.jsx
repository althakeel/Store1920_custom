'use client';

import Image from 'next/image';

/**
 * Hosts we optimize through next/image. Marketplace CDNs (Noon, Amazon, Flipkart)
 * always use unoptimized so a stale/missing next.config host never crashes pages.
 */
const OPTIMIZED_HOSTS = [
  'store1920-images.s3.ap-south-1.amazonaws.com',
  'ik.imagekit.io',
  'db.store1920.com',
  'store1920.com',
  'placehold.co',
  'lh3.googleusercontent.com',
];

export function shouldBypassNextImageOptimizer(src) {
  const value = String(src || '').trim();
  if (!value) return false;
  if (value.startsWith('/') || value.startsWith('data:') || value.startsWith('blob:')) {
    return false;
  }

  try {
    const { hostname, protocol } = new URL(value);
    if (protocol !== 'http:' && protocol !== 'https:') return true;

    const allowed = OPTIMIZED_HOSTS.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );
    // Unknown marketplace / CDN hosts: skip optimizer so pages never throw
    // "hostname is not configured under images".
    return !allowed;
  } catch {
    return true;
  }
}

/**
 * Drop-in next/image wrapper. External/unknown CDNs render with unoptimized
 * so a missing next.config host never blanks the product page.
 */
export default function SafeNextImage({ src, unoptimized, alt = '', ...props }) {
  const bypass = typeof unoptimized === 'boolean'
    ? unoptimized
    : shouldBypassNextImageOptimizer(src);

  return <Image src={src} alt={alt} unoptimized={bypass} {...props} />;
}
