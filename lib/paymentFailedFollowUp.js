export const PAYMENT_FAILED_FOLLOW_UP_PAYMENT_OPTIONS = [
  { value: 'COD', label: 'Cash on delivery' },
  { value: 'CARD', label: 'Card' },
  { value: 'TABBY', label: 'Tabby' },
  { value: 'TAMARA', label: 'Tamara' },
  { value: 'WALLET', label: 'Wallet' },
];

const ALLOWED_FOLLOW_UP_PAYMENT_METHODS = new Set(
  PAYMENT_FAILED_FOLLOW_UP_PAYMENT_OPTIONS.map((option) => option.value),
);

function normalizeFollowUpPaymentMethodRaw(value = '') {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return 'OTHER';
  if (raw === 'COD' || raw === 'CASH_ON_DELIVERY' || raw.includes('COD')) return 'COD';
  if (raw === 'TABBY' || raw.includes('TABBY')) return 'TABBY';
  if (raw === 'TAMARA' || raw.includes('TAMARA')) return 'TAMARA';
  if (raw === 'WALLET') return 'WALLET';
  if (
    ['CARD', 'STRIPE', 'RAZORPAY', 'UPI', 'NETBANKING', 'ONLINE', 'PREPAID'].includes(raw)
    || raw.includes('CARD')
    || raw.includes('STRIPE')
  ) {
    return 'CARD';
  }
  return raw;
}

export function normalizeFollowUpPaymentMethod(value = '', fallback = 'CARD') {
  const normalized = normalizeFollowUpPaymentMethodRaw(value);
  if (ALLOWED_FOLLOW_UP_PAYMENT_METHODS.has(normalized)) return normalized;
  const fallbackNormalized = normalizeFollowUpPaymentMethodRaw(fallback);
  if (ALLOWED_FOLLOW_UP_PAYMENT_METHODS.has(fallbackNormalized)) return fallbackNormalized;
  return 'CARD';
}

export function resolvePaymentFailedFollowUpPaymentMethod(order = {}) {
  const fromFollowUp = order?.paymentFailedFollowUp?.paymentMethod;
  if (fromFollowUp) return normalizeFollowUpPaymentMethod(fromFollowUp, order?.paymentMethod);
  return normalizeFollowUpPaymentMethod(order?.paymentMethod, 'CARD');
}

export function getPaymentFailedFollowUpPaymentLabel(method = '') {
  const normalized = normalizeFollowUpPaymentMethod(method);
  return PAYMENT_FAILED_FOLLOW_UP_PAYMENT_OPTIONS.find((option) => option.value === normalized)?.label
    || normalized;
}

export function isPaymentFailedStoreOrder(order = {}) {
  return String(order?.status || '').trim().toUpperCase() === 'PAYMENT_FAILED';
}

export function hasPaymentFailedFollowUp(order = {}) {
  return Boolean(order?.paymentFailedFollowUp?.savedAt);
}

export function getOrderCustomerPhone(order = {}) {
  const shipping = order?.shippingAddress || {};
  const phone = String(shipping.phone || order.guestPhone || '').trim();
  const phoneCode = String(shipping.phoneCode || order.alternatePhoneCode || '+971').trim();
  if (!phone) return { display: '', tel: '' };
  const display = phone.startsWith('+') ? phone : `${phoneCode} ${phone}`.trim();
  const tel = phone.startsWith('+') ? phone : `${phoneCode}${phone.replace(/^0+/, '')}`;
  return { display, tel };
}

export function normalizePaymentFailedDiscountType(value = '') {
  const type = String(value || 'amount').trim().toLowerCase();
  if (type === 'percent' || type === 'percentage') return 'percent';
  return 'amount';
}

export function getPaymentFailedFollowUpBaseTotal(order = {}, existingFollowUp = {}) {
  const stored = Number(existingFollowUp?.originalTotal);
  if (Number.isFinite(stored) && stored > 0) return stored;

  const current = Number(order?.total);
  if (Number.isFinite(current) && current > 0) return current;

  return 0;
}

export function calculatePaymentFailedFollowUpDiscountValue(baseTotal, discountAmount, discountType = 'amount') {
  const base = Math.max(0, Number(baseTotal) || 0);
  const value = Number(discountAmount);
  if (!Number.isFinite(value) || value <= 0 || base <= 0) return 0;

  const type = normalizePaymentFailedDiscountType(discountType);
  if (type === 'percent') {
    return Math.min(base, Math.round((base * value / 100) * 100) / 100);
  }

  return Math.min(base, Math.round(value * 100) / 100);
}

export function calculatePaymentFailedFollowUpPricing(order = {}, { discountAmount, discountType } = {}) {
  const existingFollowUp = order?.paymentFailedFollowUp || {};
  const baseTotal = getPaymentFailedFollowUpBaseTotal(order, existingFollowUp);
  const hasDiscount = discountAmount != null && Number(discountAmount) > 0;
  const discountValue = hasDiscount
    ? calculatePaymentFailedFollowUpDiscountValue(baseTotal, discountAmount, discountType)
    : 0;
  const newTotal = Math.max(0, Math.round((baseTotal - discountValue) * 100) / 100);

  return {
    baseTotal,
    discountValue,
    newTotal,
    hasDiscount,
  };
}

export function hasPaymentFailedFollowUpDiscount(order = {}) {
  const followUp = order?.paymentFailedFollowUp || {};
  return Number(followUp.discountValue) > 0 || (
    Number(followUp.discountAmount) > 0 && hasPaymentFailedFollowUp(order)
  );
}

export function formatPaymentFailedFollowUpDiscount(followUp = {}, currency = 'AED') {
  const value = Number(followUp.discountAmount);
  if (!Number.isFinite(value) || value <= 0) return '';

  const type = String(followUp.discountType || 'amount').toLowerCase();
  if (type === 'percent' || type === 'percentage') {
    return `${value}% off`;
  }
  return `${currency}${value} off`;
}

export function formatPaymentFailedFollowUpBadge(order = {}, currency = 'AED') {
  if (!isPaymentFailedStoreOrder(order) || !hasPaymentFailedFollowUp(order)) {
    return null;
  }

  const followUp = order.paymentFailedFollowUp || {};
  const discountLabel = formatPaymentFailedFollowUpDiscount(followUp, currency);
  const staffName = String(followUp.savedByName || '').trim();
  const label = discountLabel
    ? `Called by ${staffName || 'staff'} · ${discountLabel}`
    : `Called by ${staffName || 'staff'}`;

  return {
    key: 'payment-failed-follow-up',
    label,
    className: 'rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800',
    title: [
      followUp.reason,
      followUp.paymentMethod ? `Payment: ${getPaymentFailedFollowUpPaymentLabel(followUp.paymentMethod)}` : null,
      followUp.savedByEmail ? `Account: ${followUp.savedByEmail}` : null,
      Number(followUp.adjustedTotal) > 0
        ? `New total: ${currency}${followUp.adjustedTotal}`
        : null,
    ].filter(Boolean).join(' · ') || undefined,
  };
}
