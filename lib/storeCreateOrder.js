import { cleanPhoneDigits, stripEmbeddedCountryCode } from '@/lib/phoneValidation';

export function resolveGuestCity(values = {}) {
  return String(values.district || values.state || values.city || '').trim();
}

export function resolveGuestPhone(form = {}) {
  const phoneCode = form.phoneCode || '+971';
  const cleaned = cleanPhoneDigits(form.phone);
  return stripEmbeddedCountryCode(cleaned, phoneCode) || cleaned;
}

export function buildGuestInfoFromForm(form = {}) {
  const phoneCode = form.phoneCode || '+971';
  const resolvedPhone = resolveGuestPhone(form);
  const country = String(form.country || 'United Arab Emirates').trim();
  const pincode = String(form.pincode || form.zip || '').trim();

  return {
    name: String(form.name || '').trim(),
    email: String(form.email || '').trim(),
    phone: resolvedPhone,
    phoneCode,
    alternatePhone: cleanPhoneDigits(form.alternatePhone || ''),
    alternatePhoneCode: form.alternatePhone
      ? (form.alternatePhoneCode || phoneCode)
      : '',
    street: String(form.street || '').trim(),
    address: String(form.street || '').trim(),
    city: resolveGuestCity(form),
    state: String(form.state || '').trim(),
    district: String(form.district || '').trim(),
    country,
    pincode,
    zip: pincode,
  };
}

export const DEFAULT_STORE_ORDER_FORM = {
  name: '',
  email: '',
  phone: '',
  phoneCode: '+971',
  alternatePhone: '',
  alternatePhoneCode: '+971',
  street: '',
  state: 'Dubai',
  district: '',
  country: 'United Arab Emirates',
  pincode: '',
  payment: 'cod',
};
