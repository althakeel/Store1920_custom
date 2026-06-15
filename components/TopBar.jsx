'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check, Globe2 } from 'lucide-react';
import { useStorefrontMarket } from '@/lib/useStorefrontMarket';
import tabbyLogo from '@/assets/payments/tabby.webp';
import tamaraLogo from '@/assets/payments/tamara.webp';
import {
  STOREFRONT_LANGUAGE_KEY,
  STOREFRONT_LANGUAGE_EVENT,
  STOREFRONT_LANGUAGE_COOKIE,
} from '@/lib/storefrontLanguage';

const GCC_MARKETS = [
  { code: 'AE', countryName: 'United Arab Emirates', currency: 'AED', flag: '🇦🇪' },
  { code: 'SA', countryName: 'Saudi Arabia', currency: 'SAR', flag: '🇸🇦' },
  { code: 'QA', countryName: 'Qatar', currency: 'QAR', flag: '🇶🇦' },
  { code: 'KW', countryName: 'Kuwait', currency: 'KWD', flag: '🇰🇼' },
  { code: 'OM', countryName: 'Oman', currency: 'OMR', flag: '🇴🇲' },
  { code: 'BH', countryName: 'Bahrain', currency: 'BHD', flag: '🇧🇭' },
];

const BNPL_PARTNERS = [
  { key: 'tamara', name: 'Tamara', logoUrl: tamaraLogo.src, logoWidth: 74 },
  { key: 'tabby', name: 'Tabby', logoUrl: tabbyLogo.src, logoWidth: 62 },
];

export default function TopBar() {
  const router = useRouter();
  const { market: storefrontMarket, setMarketCode } = useStorefrontMarket();
  const [storefrontLanguage, setStorefrontLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    try {
      const saved = window.localStorage.getItem(STOREFRONT_LANGUAGE_KEY);
      if (saved === 'ar' || saved === 'en') return saved;
    } catch {}
    return 'en';
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeBnplIndex, setActiveBnplIndex] = useState(0);
  const [showBnplBanner, setShowBnplBanner] = useState(true);
  const [bnplLogoError, setBnplLogoError] = useState({ tamara: false, tabby: false });
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!showBnplBanner) return undefined;
    const flipIntervalId = window.setInterval(() => {
      setActiveBnplIndex((current) => (current + 1) % BNPL_PARTNERS.length);
    }, 2500);
    return () => window.clearInterval(flipIntervalId);
  }, [showBnplBanner]);

  useEffect(() => {
    let hideTimerId;
    let showTimerId;

    const startCycle = () => {
      hideTimerId = window.setTimeout(() => {
        setShowBnplBanner(false);
        showTimerId = window.setTimeout(() => {
          setShowBnplBanner(true);
          startCycle();
        }, 90000);
      }, 10000);
    };

    startCycle();
    return () => {
      window.clearTimeout(hideTimerId);
      window.clearTimeout(showTimerId);
    };
  }, []);

  const handleLanguageChange = (lang) => {
    setStorefrontLanguage(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STOREFRONT_LANGUAGE_KEY, lang);
      document.cookie = `${STOREFRONT_LANGUAGE_COOKIE}=${lang}; path=/; max-age=31536000; SameSite=Lax`;
      window.dispatchEvent(new CustomEvent(STOREFRONT_LANGUAGE_EVENT, { detail: { language: lang } }));
    }
  };

  const handleMarketChange = (code) => {
    setMarketCode(code);
    setDropdownOpen(false);
  };

  const activeBnplPartner = BNPL_PARTNERS[activeBnplIndex];
  const languageLabel = storefrontLanguage === 'ar' ? 'العربية' : 'English';
  const languageShort = storefrontLanguage === 'ar' ? 'AR' : 'EN';

  return (
    <div className="relative z-[1000] w-full border-b border-[#e7e7e7] bg-white text-xs">
      <div className="mx-auto flex max-w-[1400px] flex-nowrap items-center justify-between gap-1.5 px-2 py-1.5 sm:gap-3 sm:px-5 sm:py-1">
        <a
          href="tel:8007861920"
          className="shrink-0 whitespace-nowrap text-[11px] leading-none text-[#222] no-underline sm:text-xs"
        >
          <span className="hidden font-normal sm:inline">Support: </span>
          <span className="font-bold">8007861920</span>
        </a>

        <div className="flex shrink-0 flex-nowrap items-center gap-1 sm:gap-2.5">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((value) => !value)}
              className="flex flex-nowrap items-center gap-1 rounded-md border border-[#e2e2e2] bg-white px-1.5 py-1 text-[11px] font-medium whitespace-nowrap sm:gap-2 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-xs"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <Globe2 className="h-3.5 w-3.5 shrink-0 text-amber-600 sm:h-4 sm:w-4" />
              <span className="hidden font-semibold sm:inline">{languageLabel}</span>
              <span className="font-semibold sm:hidden">{languageShort}</span>
              <ChevronDown className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
              <span className="hidden items-center gap-1 border-l border-[#e2e2e2] pl-2 font-normal text-[#888] sm:inline-flex sm:pl-3">
                {storefrontMarket?.flag} {storefrontMarket?.currency}
              </span>
              <span className="text-[10px] font-normal text-[#888] sm:hidden">
                {storefrontMarket?.currency}
              </span>
            </button>

            {dropdownOpen && (
              <div className="absolute top-[calc(100%+6px)] right-0 z-[1001] w-[min(320px,calc(100vw-16px))] overflow-hidden rounded-2xl border border-[#e7e7e7] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.10)] sm:left-0 sm:right-auto">
                <div className="border-b border-[#efefef] p-5">
                  <div className="mb-3 text-xs font-bold tracking-wide text-[#888]">LANGUAGE</div>
                  <div className="flex flex-col gap-2">
                    <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 ${storefrontLanguage === 'ar' ? 'bg-[#fff7ed] font-bold text-amber-600' : 'text-[#222]'}`}>
                      <input type="radio" name="lang" checked={storefrontLanguage === 'ar'} onChange={() => handleLanguageChange('ar')} className="accent-amber-600" />
                      العربية
                    </label>
                    <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 ${storefrontLanguage === 'en' ? 'bg-[#fff7ed] font-bold text-amber-600' : 'text-[#222]'}`}>
                      <input type="radio" name="lang" checked={storefrontLanguage === 'en'} onChange={() => handleLanguageChange('en')} className="accent-amber-600" />
                      English
                    </label>
                  </div>
                </div>
                <div className="border-b border-[#efefef] p-5">
                  <div className="mb-3 text-xs font-bold tracking-wide text-[#888]">SHOP IN</div>
                  <div className="flex flex-col gap-2">
                    {GCC_MARKETS.map((market) => {
                      const isActive = storefrontMarket?.code === market.code;
                      return (
                        <button
                          key={market.code}
                          type="button"
                          onClick={() => handleMarketChange(market.code)}
                          className={`flex w-full items-center justify-between rounded-[10px] border px-3.5 py-2.5 ${isActive ? 'border-[#fdba74] bg-[#fff7ed] font-bold text-amber-600' : 'border-[#e7e7e7] bg-white font-medium text-[#222]'}`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="w-7 text-sm font-bold">{market.code}</span>
                            <span className="font-semibold">{market.countryName}</span>
                          </span>
                          <span className="flex flex-col items-end gap-0.5">
                            <span className="text-[13px] font-semibold">{market.currency}</span>
                            {isActive ? <Check size={18} className="text-amber-600" /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="p-5 text-[13px] text-[#444]">
                  <div className="font-semibold">Currency: {storefrontMarket?.currency}</div>
                  <div className="mt-1">You are shopping in {storefrontMarket?.countryName}.</div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => router.push('/track-order')}
            className="flex shrink-0 items-center rounded-md border border-[#e2e2e2] bg-white px-1.5 py-1 text-[11px] font-medium whitespace-nowrap sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-xs"
          >
            <span className="hidden sm:inline" role="img" aria-label="track order">🛒</span>
            <span className="sm:hidden">Track</span>
            <span className="hidden sm:inline">Track Order</span>
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden border-y border-[#ececec] bg-white transition-[max-height,opacity,transform] duration-[650ms] ease-in-out ${showBnplBanner ? 'max-h-11 opacity-100' : 'max-h-0 opacity-0 -translate-y-1.5'}`}
        aria-hidden={!showBnplBanner}
      >
        <div
          key={activeBnplPartner.key}
          className="mx-auto flex w-full max-w-[1400px] animate-[bnplFlip_560ms_ease-out] items-center justify-center gap-2 px-3 py-2 text-center sm:gap-2.5 sm:px-5"
        >
          {!bnplLogoError[activeBnplPartner.key] ? (
            <img
              src={activeBnplPartner.logoUrl}
              alt={activeBnplPartner.name}
              className="h-auto shrink-0"
              style={{ width: activeBnplPartner.logoWidth }}
              onError={() => setBnplLogoError((current) => ({ ...current, [activeBnplPartner.key]: true }))}
            />
          ) : (
            <span className="text-xs font-bold text-gray-900">{activeBnplPartner.name}</span>
          )}
          <span className="min-w-0 text-[11px] leading-snug text-gray-700 sm:text-xs">
            <span className="hidden sm:inline">Split your purchase into 4 payments with {activeBnplPartner.name}</span>
            <span className="sm:hidden">Pay in 4 with {activeBnplPartner.name}</span>
          </span>
        </div>
      </div>

      <style>{`
        @keyframes bnplFlip {
          0% { opacity: 0; transform: rotateX(58deg) translateY(-4px); }
          100% { opacity: 1; transform: rotateX(0deg) translateY(0); }
        }
      `}</style>
    </div>
  );
}
