import { isUaeCountry } from '@/lib/uaeEmirateAreas';

export function isIndiaCountry(value) {
  return String(value || '').trim().toLowerCase() === 'india';
}

export function getAddressAreaValidationError(address = {}) {
  const country = String(address.country || '').trim();
  const state = String(address.state || '').trim();
  const district = String(address.district || '').trim();

  if (isUaeCountry(country) && state && !district) {
    return {
      field: 'district',
      code: 'area_required',
      message: 'Please select your area to continue',
    };
  }

  if (isIndiaCountry(country) && state && !district) {
    return {
      field: 'district',
      code: 'district_required',
      message: 'Please select your district to continue',
    };
  }

  return null;
}

export function validateAddressPayload(address = {}) {
  const required = [
    ['name', 'Full name'],
    ['street', 'Street address'],
    ['state', 'State / Emirate'],
    ['country', 'Country'],
    ['phone', 'Phone number'],
  ];

  for (const [key, label] of required) {
    if (!String(address[key] || '').trim()) {
      return { field: key, code: 'required', message: `Please enter ${label.toLowerCase()}` };
    }
  }

  const areaError = getAddressAreaValidationError(address);
  if (areaError) return areaError;

  if (isIndiaCountry(address.country)) {
    const zip = String(address.zip || address.pincode || '').replace(/\s/g, '');
    if (!/^[1-9][0-9]{5}$/.test(zip)) {
      return { field: 'zip', code: 'pincode_invalid', message: 'Please enter a valid 6-digit Indian pincode' };
    }
  }

  return null;
}
