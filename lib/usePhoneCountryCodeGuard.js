'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clampPhoneInput,
  getEmbeddedCountryCodeMessage,
  getPhoneInputError,
  hasEmbeddedCountryCode,
  PHONE_EMBEDDED_CODE_COUNTDOWN_SECONDS,
  stripEmbeddedCountryCode,
} from '@/lib/phoneValidation';

export function usePhoneCountryCodeGuard({ phone, setPhone, countryCode = '+971' }) {
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);
  const intervalRef = useRef(null);
  const countdownActiveRef = useRef(false);
  const phoneRef = useRef(phone);
  phoneRef.current = phone;

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const embedded = hasEmbeddedCountryCode(phone, countryCode);

  useEffect(() => {
    if (!embedded) {
      countdownActiveRef.current = false;
      setCountdown(null);
      clearTimers();
      return undefined;
    }

    if (countdownActiveRef.current) {
      return undefined;
    }

    countdownActiveRef.current = true;
    setCountdown(PHONE_EMBEDDED_CODE_COUNTDOWN_SECONDS);

    intervalRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev == null || prev <= 1) return prev;
        return prev - 1;
      });
    }, 1000);

    timerRef.current = window.setTimeout(() => {
      setPhone(stripEmbeddedCountryCode(phoneRef.current, countryCode));
      countdownActiveRef.current = false;
      setCountdown(null);
      clearTimers();
    }, PHONE_EMBEDDED_CODE_COUNTDOWN_SECONDS * 1000);

    return clearTimers;
  }, [embedded, countryCode, setPhone, clearTimers]);

  const handlePhoneChange = useCallback((rawValue) => {
    const value = clampPhoneInput(rawValue, countryCode);
    setPhone(value);
  }, [countryCode, setPhone]);

  const embeddedCountdownMessage = embedded && countdown != null
    ? `${getEmbeddedCountryCodeMessage(countryCode)} — removing in ${countdown}s`
    : null;

  const validationError = !embedded ? getPhoneInputError(phone, countryCode) : null;

  return {
    handlePhoneChange,
    displayError: embeddedCountdownMessage || validationError,
    isEmbeddedCountdown: Boolean(embeddedCountdownMessage),
  };
}
