'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { flushHeatmapClicksNow, queueHeatmapClick } from '@/lib/heatmapTracking';

export default function HeatmapClickTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const handleClick = (event) => {
      queueHeatmapClick(event, pathname || window.location.pathname);
    };

    const handleUnload = () => {
      flushHeatmapClicksNow();
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
      flushHeatmapClicksNow();
    };
  }, [pathname]);

  return null;
}
