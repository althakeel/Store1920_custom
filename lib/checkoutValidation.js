import { isUaeCountry } from '@/lib/uaeEmirateAreas';
import { getAddressAreaValidationError, isIndiaCountry } from '@/lib/addressValidation';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function collectCheckoutValidationIssues({
  user,
  form,
  addressList = [],
  resolvedPhone = '',
  resolvedCountry = '',
  resolvedPincode = '',
  needsPaymentSelection = true,
}) {
  const issues = [];

  const push = (id, label) => {
    if (!issues.some((item) => item.id === id)) {
      issues.push({ id, label });
    }
  };

  if (needsPaymentSelection && !form.payment) {
    push('checkout-payment', 'Payment method');
  }

  if (user) {
    const addressId = form.addressId || addressList[0]?._id;
    const selectedAddr = addressId
      ? addressList.find((addr) => String(addr._id) === String(addressId))
      : null;

    if (!selectedAddr) {
      push('checkout-address', 'Delivery address');
      return issues;
    }

    const country = selectedAddr.country || resolvedCountry || 'United Arab Emirates';

    if (!String(selectedAddr.street || '').trim()) {
      push('checkout-address', 'Street address');
    }
    if (!String(selectedAddr.state || '').trim()) {
      push('checkout-address', isUaeCountry(country) ? 'Emirate' : 'State');
    }
    if (isUaeCountry(country) && selectedAddr.state && !String(selectedAddr.district || '').trim()) {
      push('checkout-address-area', 'Area');
    }
    if (isIndiaCountry(country) && selectedAddr.state && !String(selectedAddr.district || '').trim()) {
      push('checkout-address-district', 'District');
    }
    if (isIndiaCountry(country)) {
      const pin = String(selectedAddr.pincode || selectedAddr.zip || resolvedPincode || '').trim();
      if (!pin || pin.length !== 6) {
        push('checkout-address', 'Pincode');
      }
    }

    return issues;
  }

  if (!String(form.name || '').trim()) {
    push('guest-name', 'Full name');
  }
  if (!String(form.email || '').trim()) {
    push('guest-email', 'Email address');
  } else if (!isValidEmail(form.email)) {
    push('guest-email', 'Valid email address');
  }
  if (!String(resolvedPhone || '').trim()) {
    push('guest-phone', 'Phone number');
  }
  if (!String(form.street || '').trim()) {
    push('guest-street', 'Street address');
  }
  if (!String(form.state || '').trim()) {
    push(
      'guest-state',
      isUaeCountry(form.country) ? 'Emirate' : form.country === 'India' ? 'State' : 'State / Emirate',
    );
  }

  const country = String(resolvedCountry || form.country || '').trim();
  if (!country) {
    push('guest-country', 'Country');
  }

  if (isUaeCountry(country) && form.state && !String(form.district || '').trim()) {
    push('guest-area', 'Area');
  }
  if (isIndiaCountry(country) && form.state && !String(form.district || '').trim()) {
    push('guest-district', 'District');
  }
  if (isIndiaCountry(country)) {
    const pin = String(resolvedPincode || form.pincode || '').trim();
    if (!pin || pin.length !== 6) {
      push('guest-pincode', 'Pincode');
    }
  }

  return issues;
}

export function scrollToCheckoutField(fieldId) {
  if (!fieldId || typeof document === 'undefined') return;
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.style.transition = 'box-shadow 0.3s ease';
  el.style.boxShadow = '0 0 0 4px rgb(252 165 165)';
  window.setTimeout(() => {
    el.style.boxShadow = '0 0 0 4px rgb(254 202 202)';
  }, 400);
  window.setTimeout(() => {
    el.style.boxShadow = '';
    el.style.transition = '';
  }, 2200);
  const focusable = el.querySelector('input:not([tabindex="-1"]), button, select, textarea');
  if (focusable && typeof focusable.focus === 'function') {
    focusable.focus({ preventScroll: true });
  }
}
