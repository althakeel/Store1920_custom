'use client';

import { Heart, Search, ShoppingCart } from 'lucide-react';
import ShipXpressBadge from '@/components/ShipXpressBadge';

const DEFAULT_BG = '#9f4b1d';

export default function NavbarPreview({
  backgroundColor = DEFAULT_BG,
  logoUrl = '',
  logoWidth = 50,
  logoHeight = 50,
  navMenuEnabled = true,
  navMenuItems = [],
  navActionsVisibility = { wishlist: true, cart: true },
  userName = 'store1920',
  searchPlaceholder = 'Search products...',
}) {
  const bg = backgroundColor || DEFAULT_BG;
  const menuItems = (navMenuItems || []).filter((item) => String(item?.name || '').trim());
  const greeting = String(userName || 'store1920').trim() || 'store1920';
  const initial = greeting.charAt(0).toUpperCase();
  const logoW = Math.min(Number(logoWidth) || 50, 250);
  const logoH = Math.min(Number(logoHeight) || 50, 50);

  return (
    <div className="w-full overflow-visible rounded-xl border border-slate-200/80 shadow-sm">
      <div className="text-white" style={{ backgroundColor: bg }}>
        {/* Main navbar row — matches desktop Navbar.jsx */}
        <div className="mx-auto w-full max-w-[1400px] overflow-visible px-4 sm:px-6">
          <div className="flex items-center gap-3 overflow-visible py-2.5 sm:gap-4">
            <div className="flex shrink-0 items-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Store logo"
                  style={{
                    width: logoW,
                    height: logoH,
                    maxHeight: '50px',
                    maxWidth: '250px',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <span className="text-sm font-bold">Logo</span>
              )}
            </div>

            <div className="hidden min-w-0 flex-1 items-center justify-center gap-3 sm:flex">
              <ShipXpressBadge interactive={false} />

              <div className="min-w-0 flex-1 max-w-[590px]">
                <div
                  className="flex h-11 w-full items-center overflow-hidden rounded-2xl border px-3 shadow-sm"
                  style={{
                    borderColor: 'rgba(255,255,255,0.92)',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <span className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-xl px-2 text-[13px] font-medium text-slate-700">
                    Categories
                    <span className="text-[11px] text-slate-400">▾</span>
                  </span>
                  <span className="mx-3 h-5 w-px shrink-0 bg-slate-200" />
                  <span className="min-w-0 flex-1 truncate text-[14px] text-slate-400">
                    {searchPlaceholder}
                  </span>
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ color: bg }}
                  >
                    <Search size={15} />
                  </span>
                </div>
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5 text-[12px]">
              <div className="inline-flex items-center gap-2 rounded-full px-2 py-1.5">
                <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-indigo-700 text-[10px] font-bold text-white">
                  {initial}
                </span>
                <span className="hidden max-w-[120px] truncate font-medium text-white/95 sm:inline">
                  Hi, {greeting}
                </span>
              </div>

              {navActionsVisibility.wishlist !== false ? (
                <span className="relative inline-flex items-center justify-center rounded-full p-2">
                  <Heart size={18} />
                  <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold">
                    1
                  </span>
                </span>
              ) : null}

              {navActionsVisibility.cart !== false ? (
                <span className="relative inline-flex items-center justify-center rounded-full p-2">
                  <ShoppingCart size={18} />
                  <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold">
                    2
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          {/* Mobile-style search fallback on very narrow admin sidebars */}
          <div className="pb-2.5 sm:hidden">
            <div
              className="flex h-9 w-full items-center overflow-hidden rounded-2xl border px-3"
              style={{
                borderColor: 'rgba(255,255,255,0.92)',
                backgroundColor: '#ffffff',
              }}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-slate-400">{searchPlaceholder}</span>
              <Search size={14} className="shrink-0 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Menu bar row — matches NavbarMenuBar */}
        {navMenuEnabled && menuItems.length > 0 ? (
          <div
            className="border-t"
            style={{
              borderColor: 'rgba(255,255,255,0.14)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            <div className="mx-auto w-full max-w-[1400px] overflow-x-auto px-4 py-2 scrollbar-hide sm:px-6">
              <div className="flex items-center whitespace-nowrap text-sm font-semibold uppercase tracking-wide text-white/90">
                {menuItems.map((item, index) => (
                  <span key={`${item.name}-${index}`} className="inline-flex items-center">
                    {index > 0 ? <span className="px-2 text-xs opacity-40 select-none">|</span> : null}
                    <span className="px-2 py-1.5">{item.name}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : navMenuEnabled ? (
          <div
            className="border-t px-4 py-2 text-xs text-white/60 sm:px-6"
            style={{ borderColor: 'rgba(255,255,255,0.14)' }}
          >
            Add menu items to show navigation links
          </div>
        ) : (
          <div
            className="border-t px-4 py-2 text-xs text-white/60 sm:px-6"
            style={{ borderColor: 'rgba(255,255,255,0.14)' }}
          >
            Desktop menu disabled
          </div>
        )}
      </div>
    </div>
  );
}
