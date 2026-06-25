'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ProductPageSkeleton from '@/components/ProductPageSkeleton';

const DEFAULT_DELAY_MS = 120;

export function useDelayedVisible(active, delayMs = DEFAULT_DELAY_MS) {
  const [visible, setVisible] = useState(delayMs <= 0);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return undefined;
    }

    if (delayMs <= 0) {
      setVisible(true);
      return undefined;
    }

    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return visible;
}

export function ProductPageSpinner({ size = 20, className = '' }) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-slate-400 ${className}`.trim()}
      aria-hidden
    />
  );
}

export default function ProductPageDelayedLoader({ delayMs = DEFAULT_DELAY_MS, className = '' }) {
  const showSkeleton = useDelayedVisible(true, delayMs);

  if (!showSkeleton) {
    return <div className={`min-h-[50vh] bg-white ${className}`.trim()} aria-hidden />;
  }

  return <ProductPageSkeleton />;
}

export function ProductPageLoadingBadge({ show, delayMs = DEFAULT_DELAY_MS }) {
  const visible = useDelayedVisible(show, delayMs);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center sm:top-24">
      <div
        className="flex items-center justify-center rounded-full bg-white/95 px-3 py-2 shadow-sm ring-1 ring-slate-200"
        role="status"
        aria-live="polite"
        aria-label="Loading product"
      >
        <ProductPageSpinner size={20} />
      </div>
    </div>
  );
}
