'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  convertPriceFromAed,
  formatConvertedAmount,
  getStorefrontMarket,
  persistStorefrontMarket,
  readStoredStorefrontMarket,
  STOREFRONT_MARKET_EVENT,
  DEFAULT_STOREFRONT_MARKET,
} from '@/lib/storefrontMarket';

export function useStorefrontMarket() {
  const [marketCode, setMarketCodeState] = useState(DEFAULT_STOREFRONT_MARKET);

  useEffect(() => {
    setMarketCodeState(readStoredStorefrontMarket());

    const handleMarketChange = (event) => {
      const nextCode = event?.detail?.marketCode || readStoredStorefrontMarket();
      setMarketCodeState(nextCode);
    };

    window.addEventListener(STOREFRONT_MARKET_EVENT, handleMarketChange);
    return () => {
      window.removeEventListener(STOREFRONT_MARKET_EVENT, handleMarketChange);
    };
  }, []);

  const setMarketCode = useCallback((nextMarketCode) => {
    const normalizedCode = persistStorefrontMarket(nextMarketCode);
    setMarketCodeState(normalizedCode);
  }, []);

  const market = useMemo(() => getStorefrontMarket(marketCode), [marketCode]);

  const convertPrice = useCallback((amount) => {
    return convertPriceFromAed(amount, market.code);
  }, [market.code]);

  const formatAmount = useCallback((amount, options) => {
    return formatConvertedAmount(amount, market.code, options);
  }, [market.code]);

  return {
    marketCode: market.code,
    market,
    setMarketCode,
    convertPrice,
    formatAmount,
  };
}