'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const MAX_ITEMS = 12;
const SKELETON_ITEMS = Array.from({ length: 8 });
const NAVBAR_APPEARANCE_CACHE_KEY = 'navbarAppearanceCacheV1';

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
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(NAVBAR_APPEARANCE_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (typeof cached?.backgroundColor === 'string' && cached.backgroundColor.trim()) {
            setBackgroundColor(cached.backgroundColor);
            setTextColor(getContrastColor(cached.backgroundColor));
          }
          if (typeof cached?.logoUrl === 'string') setLogoUrl(cached.logoUrl);
          if (Number.isFinite(Number(cached?.logoWidth))) setLogoWidth(Number(cached.logoWidth));
          if (Number.isFinite(Number(cached?.logoHeight))) setLogoHeight(Number(cached.logoHeight));
        }
      } catch (error) {
        // Ignore cache parse issues.
      }
    }

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
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            NAVBAR_APPEARANCE_CACHE_KEY,
            JSON.stringify({
              logoUrl: data.logoUrl || '',
              logoWidth: data.logoWidth ?? 120,
              logoHeight: data.logoHeight ?? 40,
              backgroundColor: nextBackgroundColor,
            })
          );
        }
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
      if (typeof window !== 'undefined') {
        const next = {
          logoUrl: typeof detail.logoUrl === 'string' ? detail.logoUrl : logoUrl,
          logoWidth: detail.logoWidth || logoWidth,
          logoHeight: detail.logoHeight || logoHeight,
          backgroundColor: typeof detail.backgroundColor === 'string' && detail.backgroundColor.trim() ? detail.backgroundColor : backgroundColor,
        };
        window.localStorage.setItem(NAVBAR_APPEARANCE_CACHE_KEY, JSON.stringify(next));
      }
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

  return (
    <div className="w-full border-b border-gray-200" style={{ backgroundColor, color: textColor }}>
      <div className="max-w-[1240px] mx-auto px-4 py-2.5">
        <div
          className="flex items-center justify-start gap-3 overflow-x-auto whitespace-nowrap"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
        >
          <Link
            href="/shop"
            className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.02em] uppercase transition whitespace-nowrap opacity-95 hover:opacity-75"
          >
          <span>All</span>
          </Link>
          {loading && (
            <div className="flex items-center gap-3">
              {SKELETON_ITEMS.map((_, idx) => (
                <div key={`skeleton-${idx}`} className="flex items-center flex-shrink-0">
                  <span className="mx-2 text-gray-400">|</span>
                  <div className="h-4 w-20 rounded-full bg-gray-200 animate-pulse" />
                </div>
              ))}
            </div>
          )}
          {!loading && items.map((item, index) => (
            <div key={`${item.label || item.name || 'menu'}-${index}`} className="flex items-center flex-shrink-0">
              <span className="mx-2 opacity-50">|</span>
              <Link
                href={normalizeUrl(item)}
                className="text-[13px] font-semibold tracking-[0.01em] transition whitespace-nowrap opacity-95 hover:opacity-75"
              >
                {item.label || item.name || 'Menu'}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
