'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check, Globe2 } from 'lucide-react';
import {
  STORE1920_CUSTOMER_SUPPORT_PHONE,
  STORE1920_CUSTOMER_SUPPORT_TEL,
} from '@/lib/storeContact';
import { useStorefrontMarket } from '@/lib/useStorefrontMarket';
import tabbyLogo from '@/assets/payments/tabby.webp';
import tamaraLogo from '@/assets/payments/tamara.webp';
import {
  STOREFRONT_LANGUAGE_KEY,
  STOREFRONT_LANGUAGE_EVENT,
  STOREFRONT_LANGUAGE_COOKIE,
  normalizeStorefrontLanguage,
  readPersistedStorefrontLanguage,
} from '@/lib/storefrontLanguage';

const GCC_MARKETS = [
  { code: 'AE', countryName: 'United Arab Emirates', countryNameAr: 'الإمارات العربية المتحدة', currency: 'AED', flag: '🇦🇪' },
  { code: 'SA', countryName: 'Saudi Arabia', countryNameAr: 'المملكة العربية السعودية', currency: 'SAR', flag: '🇸🇦' },
  { code: 'QA', countryName: 'Qatar', countryNameAr: 'قطر', currency: 'QAR', flag: '🇶🇦' },
  { code: 'KW', countryName: 'Kuwait', countryNameAr: 'الكويت', currency: 'KWD', flag: '🇰🇼' },
  { code: 'OM', countryName: 'Oman', countryNameAr: 'عُمان', currency: 'OMR', flag: '🇴🇲' },
  { code: 'BH', countryName: 'Bahrain', countryNameAr: 'البحرين', currency: 'BHD', flag: '🇧🇭' },
];

const BNPL_PARTNERS = [
  { key: 'tamara', name: 'Tamara', logoUrl: tamaraLogo.src, logoWidth: 74 },
  { key: 'tabby', name: 'Tabby', logoUrl: tabbyLogo.src, logoWidth: 62 },
];

export default function TopBar({ initialLanguage = 'en' }) {
  const router = useRouter();
  const { market: storefrontMarket, setMarketCode } = useStorefrontMarket();
  const [storefrontLanguage, setStorefrontLanguage] = useState(() => normalizeStorefrontLanguage(initialLanguage));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeBnplIndex, setActiveBnplIndex] = useState(0);
  const [showBnplBanner, setShowBnplBanner] = useState(true);
  const [bnplLogoError, setBnplLogoError] = useState({ tamara: false, tabby: false });
  const dropdownRef = useRef(null);
  const suppressToggleRef = useRef(false);

  const closeDropdown = () => {
    suppressToggleRef.current = true;
    setDropdownOpen(false);
    window.setTimeout(() => {
      suppressToggleRef.current = false;
    }, 250);
  };

  const toggleDropdown = () => {
    if (suppressToggleRef.current) return;
    setDropdownOpen((value) => !value);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncLanguage = () => {
      setStorefrontLanguage(readPersistedStorefrontLanguage(initialLanguage));
    };

    const handleLanguageChange = (event) => {
      const nextLanguage = event?.detail?.language;
      setStorefrontLanguage(normalizeStorefrontLanguage(nextLanguage));
    };

    syncLanguage();
    window.addEventListener(STOREFRONT_LANGUAGE_EVENT, handleLanguageChange);

    return () => {
      window.removeEventListener(STOREFRONT_LANGUAGE_EVENT, handleLanguageChange);
    };
  }, [initialLanguage]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeDropdown();
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
    const nextLanguage = normalizeStorefrontLanguage(lang);
    setStorefrontLanguage(nextLanguage);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STOREFRONT_LANGUAGE_KEY, nextLanguage);
      document.cookie = `${STOREFRONT_LANGUAGE_COOKIE}=${nextLanguage}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.setAttribute('lang', nextLanguage === 'ar' ? 'ar' : 'en');
      document.documentElement.setAttribute('dir', nextLanguage === 'ar' ? 'rtl' : 'ltr');
      window.dispatchEvent(new CustomEvent(STOREFRONT_LANGUAGE_EVENT, { detail: { language: nextLanguage } }));
    }
    closeDropdown();
  };

  const handleMarketChange = (code) => {
    setMarketCode(code);
    closeDropdown();
  };

  const activeBnplPartner = BNPL_PARTNERS[activeBnplIndex];
  const isArabic = storefrontLanguage === 'ar';
  const languageLabel = isArabic ? 'العربية' : 'English';
  const languageShort = isArabic ? 'AR' : 'EN';
  const activeMarket = GCC_MARKETS.find((market) => market.code === storefrontMarket?.code) || GCC_MARKETS[0];
  const activeCountryName = isArabic ? activeMarket.countryNameAr : activeMarket.countryName;

  const copy = isArabic
    ? {
        language: 'اللغة',
        shopIn: 'تسوّق في',
        currency: 'العملة',
        shoppingIn: `أنت تتسوق في ${activeCountryName}.`,
      }
    : {
        language: 'Language',
        shopIn: 'Shop in',
        currency: 'Currency',
        shoppingIn: `You are shopping in ${activeCountryName}.`,
      };

  return (
    <div className="relative z-[1000] w-full border-b border-[#e7e7e7] bg-white text-xs">
      <div className="mx-auto flex max-w-[1400px] flex-nowrap items-center justify-between gap-1.5 px-2 py-1.5 sm:gap-3 sm:px-5 sm:py-1">
        <a
          href={STORE1920_CUSTOMER_SUPPORT_TEL}
          className="shrink-0 whitespace-nowrap text-[11px] leading-none text-[#222] no-underline sm:text-xs"
        >
          <span className="font-normal text-[#666] sm:hidden">Toll-free: </span>
          <span className="hidden font-normal sm:inline">Support: </span>
          <span className="font-bold">{STORE1920_CUSTOMER_SUPPORT_PHONE}</span>
        </a>

        <div className="flex shrink-0 flex-nowrap items-center gap-1 sm:gap-2.5">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={toggleDropdown}
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
              <div
                dir={isArabic ? 'rtl' : 'ltr'}
                className="absolute top-[calc(100%+8px)] end-0 z-[1001] w-[min(320px,calc(100vw-24px))] max-h-[min(72vh,520px)] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.14)] sm:start-0 sm:end-auto sm:w-[320px]"
                onMouseDown={(event) => event.stopPropagation()}
              >
                  <div className="border-b border-gray-100 px-4 py-4">
                    <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                      {copy.language}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { value: 'ar', label: 'العربية' },
                        { value: 'en', label: 'English' },
                      ].map((option) => {
                        const isActive = storefrontLanguage === option.value;
                        return (
                          <label
                            key={option.value}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleLanguageChange(option.value);
                            }}
                            className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition ${
                              isActive
                                ? 'bg-orange-50 font-semibold text-orange-700 ring-1 ring-orange-200'
                                : 'text-gray-800 hover:bg-gray-50'
                            }`}
                          >
                            <span className="text-sm">{option.label}</span>
                            <input
                              type="radio"
                              name="lang"
                              checked={isActive}
                              readOnly
                              className="h-4 w-4 shrink-0 accent-orange-600 pointer-events-none"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-b border-gray-100 px-4 py-4">
                    <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                      {copy.shopIn}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {GCC_MARKETS.map((market) => {
                        const isActive = storefrontMarket?.code === market.code;
                        const countryName = isArabic ? market.countryNameAr : market.countryName;
                        return (
                          <button
                            key={market.code}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleMarketChange(market.code);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition ${
                              isActive
                                ? 'border-orange-300 bg-orange-50 text-orange-800 ring-1 ring-orange-200'
                                : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <span className="text-lg leading-none">{market.flag}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                                {market.code}
                              </span>
                              <span className="block truncate text-sm font-semibold">{countryName}</span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-sm font-semibold">{market.currency}</span>
                              {isActive ? <Check size={16} className="text-orange-600" strokeWidth={2.5} /> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="px-4 py-3.5 text-sm text-gray-600">
                    <div className="font-semibold text-gray-800">
                      {copy.currency}: {storefrontMarket?.currency}
                    </div>
                    <div className="mt-1 leading-snug">{copy.shoppingIn}</div>
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
