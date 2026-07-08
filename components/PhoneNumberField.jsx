'use client';

import {
  getPhoneInputHint,
  getPhoneMaxLength,
  getPhonePlaceholder,
  getPhoneValidationMessage,
} from '@/lib/phoneValidation';
import { UAE_PHONE_CODE, UAE_PHONE_CODE_OPTIONS } from '@/assets/countryCodes';
import { usePhoneCountryCodeGuard } from '@/lib/usePhoneCountryCodeGuard';

export default function PhoneNumberField({
  phone,
  phoneCode,
  onPhoneChange,
  onPhoneCodeChange,
  countryOptions = UAE_PHONE_CODE_OPTIONS,
  id,
  label,
  labelClassName = 'mb-1.5 block text-sm font-semibold text-slate-700',
  selectClassName = 'min-w-[88px] rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 font-medium text-slate-700 outline-none transition focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]',
  inputClassName = 'flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]',
  wrapperClassName = 'flex gap-2',
  hintClassName = 'mt-1 text-xs text-slate-500',
  errorClassName = 'mt-1 text-xs font-medium text-red-500',
  required = true,
  showHint = true,
  showLabel = true,
  inputKey,
}) {
  const resolvedOptions = countryOptions.length > 0 ? countryOptions : UAE_PHONE_CODE_OPTIONS;
  const resolvedPhoneCode = resolvedOptions.some((c) => c.code === phoneCode)
    ? phoneCode
    : (resolvedOptions[0]?.code || UAE_PHONE_CODE);
  const singleCode = resolvedOptions.length === 1;

  const { handlePhoneChange, displayError } = usePhoneCountryCodeGuard({
    phone,
    setPhone: onPhoneChange,
    countryCode: resolvedPhoneCode,
  });

  return (
    <div>
      {showLabel && label ? (
        <label htmlFor={id} className={labelClassName}>{label}</label>
      ) : null}
      <div className={wrapperClassName}>
        {singleCode ? (
          <span
            className={selectClassName}
            aria-label="Phone country code"
          >
            {resolvedPhoneCode}
          </span>
        ) : (
          <select
            name="phoneCode"
            onChange={onPhoneCodeChange}
            value={resolvedPhoneCode}
            className={selectClassName}
            required={required}
            aria-label="Phone country code"
          >
            {resolvedOptions.map((country) => (
              <option key={country.code} value={country.code}>{country.code}</option>
            ))}
          </select>
        )}
        <input
          key={inputKey}
          id={id}
          name="phone"
          value={phone || ''}
          onChange={(e) => handlePhoneChange(e.target.value)}
          className={inputClassName}
          type="text"
          inputMode="numeric"
          placeholder={getPhonePlaceholder(resolvedPhoneCode)}
          maxLength={getPhoneMaxLength(resolvedPhoneCode)}
          pattern={resolvedPhoneCode === '+91' || resolvedPhoneCode === '+92' ? '[0-9]{10}' : '[0-9]{9,10}'}
          title={getPhoneValidationMessage(resolvedPhoneCode)}
          required={required}
          autoComplete="tel"
        />
      </div>
      {showHint ? (
        <p className={hintClassName}>{getPhoneInputHint(resolvedPhoneCode)}</p>
      ) : null}
      {displayError ? (
        <p className={errorClassName}>{displayError}</p>
      ) : null}
    </div>
  );
}
