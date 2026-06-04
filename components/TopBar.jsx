import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check, Globe2 } from "lucide-react";
import { useStorefrontMarket } from '@/lib/useStorefrontMarket';
import tabbyLogo from '@/assets/payments/tabby.webp';
import tamaraLogo from '@/assets/payments/tamara.webp';
import {
  STOREFRONT_LANGUAGE_KEY,
  STOREFRONT_LANGUAGE_EVENT,
  STOREFRONT_LANGUAGE_COOKIE,
} from '@/lib/storefrontLanguage';


const TopBar = () => {
  const router = useRouter();
  const { market: storefrontMarket, setMarketCode } = useStorefrontMarket();
  const BNPL_PARTNERS = [
    {
      key: 'tamara',
      name: 'Tamara',
      logoUrl: tamaraLogo.src,
      logoWidth: 74,
    },
    {
      key: 'tabby',
      name: 'Tabby',
      logoUrl: tabbyLogo.src,
      logoWidth: 62,
    }
  ];

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
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
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
  }, [showBnplBanner, BNPL_PARTNERS.length]);

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

  // GCC_MARKETS from lib
  const GCC_MARKETS = [
    { code: 'AE', countryName: 'United Arab Emirates', currency: 'AED', flag: '🇦🇪' },
    { code: 'SA', countryName: 'Saudi Arabia', currency: 'SAR', flag: '🇸🇦' },
    { code: 'QA', countryName: 'Qatar', currency: 'QAR', flag: '🇶🇦' },
    { code: 'KW', countryName: 'Kuwait', currency: 'KWD', flag: '🇰🇼' },
    { code: 'OM', countryName: 'Oman', currency: 'OMR', flag: '🇴🇲' },
    { code: 'BH', countryName: 'Bahrain', currency: 'BHD', flag: '🇧🇭' }
  ];
  const activeBnplPartner = BNPL_PARTNERS[activeBnplIndex];

  return (
    <div style={{
      background: '#fff',
      borderBottom: '0.5px solid #e7e7e7',
      fontSize: '12px',
      zIndex: 1000,
      width: '100%',
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 20px',
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
        <span>Support: <a href="tel:8007861920" style={{ color: '#222', textDecoration: 'none', fontWeight: 700 }}>8007861920</a></span>
        <span style={{ position: 'relative' }} ref={dropdownRef}>
          <button onClick={() => setDropdownOpen((v) => !v)} style={{ background: 'none', border: '0.5px solid #e2e2e2', borderRadius: 8, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}>
            <Globe2 size={17} style={{ color: '#d97706' }} />
            <span style={{ fontWeight: 600 }}>{storefrontLanguage === 'ar' ? 'العربية' : 'English'}</span>
            <ChevronDown size={17} />
            <span style={{ marginLeft: 12, fontWeight: 400, color: '#888', borderLeft: '0.5px solid #e2e2e2', paddingLeft: 12 }}> {storefrontMarket?.flag} {storefrontMarket?.currency}</span>
          </button>
          {dropdownOpen && (
            <div style={{ position: 'absolute', top: '120%', left: 0, background: '#fff', border: '0.5px solid #e7e7e7', borderRadius: 16, minWidth: 320, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', zIndex: 1001, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: 20, borderBottom: '0.5px solid #efefef' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#888', letterSpacing: 1, marginBottom: 12 }}>LANGUAGE</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: storefrontLanguage === 'ar' ? 700 : 400, color: storefrontLanguage === 'ar' ? '#d97706' : '#222', background: storefrontLanguage === 'ar' ? '#fff7ed' : 'transparent', borderRadius: 8, padding: '6px 10px' }}>
                    <input type="radio" name="lang" checked={storefrontLanguage === 'ar'} onChange={() => handleLanguageChange('ar')} style={{ accentColor: '#d97706' }} /> العربية
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: storefrontLanguage === 'en' ? 700 : 400, color: storefrontLanguage === 'en' ? '#d97706' : '#222', background: storefrontLanguage === 'en' ? '#fff7ed' : 'transparent', borderRadius: 8, padding: '6px 10px' }}>
                    <input type="radio" name="lang" checked={storefrontLanguage === 'en'} onChange={() => handleLanguageChange('en')} style={{ accentColor: '#d97706' }} /> English
                  </label>
                </div>
              </div>
              <div style={{ padding: 20, borderBottom: '0.5px solid #efefef' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#888', letterSpacing: 1, marginBottom: 12 }}>SHOP IN</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {GCC_MARKETS.map((market) => (
                    <button key={market.code} onClick={() => handleMarketChange(market.code)} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '0.5px solid', borderColor: storefrontMarket?.code === market.code ? '#fdba74' : '#e7e7e7', background: storefrontMarket?.code === market.code ? '#fff7ed' : '#fff', color: storefrontMarket?.code === market.code ? '#d97706' : '#222', borderRadius: 10, padding: '10px 14px', fontWeight: storefrontMarket?.code === market.code ? 700 : 500, justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, width: 28 }}>{market.code}</span>
                        <span style={{ fontWeight: 600 }}>{market.countryName}</span>
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{market.currency}</span>
                        {storefrontMarket?.code === market.code && <Check size={18} color="#d97706" />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ padding: 20, fontSize: 13, color: '#444' }}>
                <div style={{ fontWeight: 600 }}>Currency: {storefrontMarket?.currency}</div>
                <div style={{ marginTop: 4 }}>You are shopping in {storefrontMarket?.countryName}.</div>
              </div>
            </div>
          )}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/track-order')} style={{ border: '0.5px solid #e2e2e2', background: '#fff', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span role="img" aria-label="track order">🛒</span> Track Order
        </button>
      </div>
    </div>

    <div
      style={{
        borderTop: '0.5px solid #ececec',
        borderBottom: '0.5px solid #ececec',
        background: '#fff',
        overflow: 'hidden',
        maxHeight: showBnplBanner ? 44 : 0,
        opacity: showBnplBanner ? 1 : 0,
        transform: showBnplBanner ? 'translateY(0)' : 'translateY(-6px)',
        transition: 'max-height 650ms ease-in-out, opacity 650ms ease-in-out, transform 650ms ease-in-out',
      }}
      aria-hidden={!showBnplBanner}
    >
      <div
        key={activeBnplPartner.key}
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          width: '100%',
          padding: '8px 20px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          animation: 'bnplFlip 560ms ease-out',
          textAlign: 'center',
        }}
      >
        {!bnplLogoError[activeBnplPartner.key] ? (
          <img
            src={activeBnplPartner.logoUrl}
            alt={activeBnplPartner.name}
            style={{ width: activeBnplPartner.logoWidth, height: 'auto', display: 'block' }}
            onError={() => {
              setBnplLogoError((current) => ({ ...current, [activeBnplPartner.key]: true }));
            }}
          />
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{activeBnplPartner.name}</span>
        )}
        <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.25 }}>
          Split your purchase into 4 payments with {activeBnplPartner.name}
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
};

export default TopBar;
