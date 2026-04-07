'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const MAX_ITEMS = 20;
const SKELETON_ITEMS = Array.from({ length: 8 });
const FULL_WIDTH_MAX_ITEMS = 14;

const getContrastColor = (hexColor) => {
  const hex = String(hexColor || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#1f2937';
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.65 ? '#111827' : '#ffffff';
};

export default function NavbarMenuBar() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoWidth, setLogoWidth] = useState(120);
  const [logoHeight, setLogoHeight] = useState(40);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#1f2937');

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const response = await fetch('/api/store/navbar-menu', { cache: 'no-store' });
        if (!response.ok) {
          setItems([]);
          setLoading(false);
          return;
        }
        const data = await response.json();
        const nextItems = Array.isArray(data.items) ? data.items.slice(0, MAX_ITEMS) : [];
        setItems(nextItems);
        setLogoUrl(data.logoUrl || '');
        setLogoWidth(data.logoWidth ?? 120);
        setLogoHeight(data.logoHeight ?? 40);
        const nextBackgroundColor = data.backgroundColor || '#ffffff';
        setBackgroundColor(nextBackgroundColor);
        setTextColor(getContrastColor(nextBackgroundColor));
      } catch (error) {
        console.error('Navbar menu fetch error:', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();

    const handleNavbarAppearanceUpdate = (event) => {
      const detail = event?.detail || {};
      if (typeof detail.backgroundColor === 'string' && detail.backgroundColor.trim()) {
        setBackgroundColor(detail.backgroundColor);
        setTextColor(getContrastColor(detail.backgroundColor));
      }
      if (typeof detail.logoUrl === 'string') setLogoUrl(detail.logoUrl);
      if (detail.logoWidth) setLogoWidth(detail.logoWidth);
      if (detail.logoHeight) setLogoHeight(detail.logoHeight);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('navbarAppearanceUpdated', handleNavbarAppearanceUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('navbarAppearanceUpdated', handleNavbarAppearanceUpdate);
      }
    };
  }, []);

  if (!loading && items.length === 0) return null;

  const normalizeUrl = (item) => {
    if (item?.url) return item.url;
    if (item?.categoryId) return `/shop?category=${item.categoryId}`;
    return '/shop';
  };

  const menuEntries = [
    { label: 'All', url: '/shop', isAll: true },
    ...items.map((item) => ({
      label: item.label || item.name || 'Menu',
      url: normalizeUrl(item),
      isAll: false,
    })),
  ];

  const gridStyle = useMemo(() => {
    if (menuEntries.length <= FULL_WIDTH_MAX_ITEMS) {
      return {
        gridTemplateColumns: `repeat(${menuEntries.length}, minmax(0, 1fr))`,
        width: '100%',
      };
    }

    const minColumnWidth = 88;
    return {
      gridTemplateColumns: `repeat(${menuEntries.length}, minmax(${minColumnWidth}px, 1fr))`,
      minWidth: `${menuEntries.length * minColumnWidth}px`,
    };
  }, [menuEntries.length]);

  return (
    <div
      className="hidden lg:block w-full border-t"
      style={{ backgroundColor, color: textColor, borderColor: `${textColor}14` }}
    >
      <div className="max-w-[1400px] mx-auto px-4 py-1.5 sm:px-6">
        <div
          className="overflow-x-auto"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
        >
          {loading && (
            <div className="flex items-center gap-3">
              {SKELETON_ITEMS.map((_, idx) => (
                <div key={`skeleton-${idx}`} className="flex items-center flex-shrink-0">
                  <div className="h-4 w-20 rounded-full bg-gray-200 animate-pulse" />
                </div>
              ))}
            </div>
          )}
          {!loading && (
            <div
              className="grid w-full items-center"
              style={gridStyle}
            >
              {menuEntries.map((item, index) => (
                <div
                  key={`${item.label}-${index}`}
                  className="relative flex min-w-0 items-center justify-center px-2 py-0.5 text-center"
                >
                  {index > 0 ? (
                    <span
                      className="pointer-events-none absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-medium"
                      style={{ color: `${textColor}80` }}
                    >
                      |
                    </span>
                  ) : null}
                  <Link
                    href={item.url}
                    className={item.isAll
                      ? 'relative block w-full max-w-full truncate rounded-full px-3 py-1 text-center text-[12px] font-semibold uppercase tracking-[0.02em] transition hover:bg-white/14'
                      : 'relative block w-full max-w-full truncate rounded-full px-3 py-1 text-center text-[12px] font-medium transition hover:bg-white/10'}
                    title={item.label}
                  >
                    {item.label}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
