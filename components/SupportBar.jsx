'use client';

import { useEffect, useState } from 'react';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';

const NAVBAR_APPEARANCE_CACHE_KEY = 'navbarAppearanceCache';
const DEFAULT_NAVBAR_BG = '#8f3404';

function readCachedNavbarBg() {
  if (typeof window === 'undefined') return DEFAULT_NAVBAR_BG;

  try {
    const raw = window.localStorage.getItem(NAVBAR_APPEARANCE_CACHE_KEY);
    if (!raw) return DEFAULT_NAVBAR_BG;

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.backgroundColor === 'string' && parsed.backgroundColor.trim()) {
      return parsed.backgroundColor.trim();
    }
  } catch {
    // Ignore cache read failures.
  }

  return DEFAULT_NAVBAR_BG;
}

function HeadsetIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 18v-6a9 9 0 0118 0v6" />
      <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5z" />
      <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z" />
    </svg>
  );
}

function MailIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 8l10 6 10-6" />
    </svg>
  );
}

export default function SupportBar() {
  const { t } = useStorefrontI18n();
  const [navbarBg, setNavbarBg] = useState(DEFAULT_NAVBAR_BG);

  useEffect(() => {
    setNavbarBg(readCachedNavbarBg());

    const controller = new AbortController();

    fetch(`/api/store/navbar-menu?t=${Date.now()}`, { cache: 'no-store', signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const nextBg = String(data?.backgroundColor || '').trim();
        if (nextBg) setNavbarBg(nextBg);
      })
      .catch(() => {});

    const handleNavbarAppearanceUpdate = (event) => {
      const nextBg = event?.detail?.backgroundColor;
      if (typeof nextBg === 'string' && nextBg.trim()) {
        setNavbarBg(nextBg.trim());
        return;
      }
      setNavbarBg(readCachedNavbarBg());
    };

    window.addEventListener('navbarAppearanceUpdated', handleNavbarAppearanceUpdate);
    return () => {
      controller.abort();
      window.removeEventListener('navbarAppearanceUpdated', handleNavbarAppearanceUpdate);
    };
  }, []);

  return (
    <section className="w-full text-white" style={{ backgroundColor: navbarBg }} aria-label="Customer support">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-3 py-1.5 sm:gap-4 sm:px-6 sm:py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 sm:h-7 sm:w-7">
            <HeadsetIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </span>
          <div className="min-w-0 leading-none sm:leading-tight">
            <p className="truncate text-[11px] font-semibold sm:text-sm">{t('support.title')}</p>
            <p className="mt-0.5 hidden truncate text-[11px] text-white/75 sm:block">{t('support.subtitle')}</p>
          </div>
        </div>

        <a
          href="mailto:support@Store1920.com"
          title="support@Store1920.com"
          aria-label="Email support at support@Store1920.com"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium text-white transition hover:bg-white/16 sm:gap-1.5 sm:bg-white/12 sm:px-3 sm:py-1 sm:text-[13px] sm:hover:bg-white/18"
        >
          <MailIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span className="sm:hidden">Email</span>
          <span className="hidden sm:inline">support@Store1920.com</span>
        </a>
      </div>
    </section>
  );
}
