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
  paymentReferenceId: '',
};

export const STORE_ORDER_PAYMENT_OPTIONS = [
  { value: 'cod', label: 'Cash on delivery (COD)', apiValue: 'COD' },
  { value: 'card', label: 'Paid online / card (mark as paid)', apiValue: 'CARD' },
  { value: 'stripe', label: 'Stripe', apiValue: 'STRIPE' },
  { value: 'tabby', label: 'Tabby', apiValue: 'TABBY' },
  { value: 'tamara', label: 'Tamara', apiValue: 'TAMARA' },
];

export function mapStoreOrderPaymentMethod(payment = 'cod') {
  const option = STORE_ORDER_PAYMENT_OPTIONS.find((entry) => entry.value === payment);
  return option?.apiValue || String(payment || 'COD').toUpperCase();
}

export function storeOrderPaymentNeedsReference(payment = '') {
  return ['stripe', 'tabby', 'tamara'].includes(String(payment || '').toLowerCase());
}

export function isManualStoreDashboardOrder(order = {}) {
  if (order?.manualStoreOrder) return true;

  const source = String(order?.attribution?.utmSource || '').toLowerCase();
  const medium = String(order?.attribution?.utmMedium || '').toLowerCase();
  if (source === 'store_admin' && (medium === 'manual_order' || medium === 'abandoned_checkout_conversion')) return true;

  return /created manually by .+ from store dashboard/i.test(String(order?.notes || ''));
}

export function getManualStoreOrderCreator(order = {}) {
  if (order?.storeCreatedByName) {
    return {
      name: String(order.storeCreatedByName).trim(),
      uid: order.storeCreatedByUid || order.attribution?.utmCampaign || null,
    };
  }

  const notes = String(order?.notes || '');
  const match = notes.match(/created manually by (.+?) from store dashboard/i);
  if (match?.[1]) {
    return {
      name: match[1].trim(),
      uid: order.storeCreatedByUid || order.attribution?.utmCampaign || null,
    };
  }

  if (isManualStoreDashboardOrder(order)) {
    return {
      name: 'Store staff',
      uid: order.attribution?.utmCampaign || null,
    };
  }

  return null;
}

export function getOrderPaymentReferenceId(order = {}) {
  if (order?.paymentReferenceId) {
    return String(order.paymentReferenceId).trim();
  }

  const method = String(order?.paymentMethod || '').toUpperCase();
  if (method === 'TABBY' && order?.tabbyPaymentId) {
    return String(order.tabbyPaymentId).trim();
  }
  if (method === 'TAMARA' && order?.tamaraOrderId) {
    return String(order.tamaraOrderId).trim();
  }

  const notes = String(order?.notes || '');
  const refMatch = notes.match(/(?:STRIPE|TABBY|TAMARA) reference:\s*(.+)/i);
  return refMatch?.[1]?.trim() || '';
}

export function orderPaymentReferenceLabel(paymentMethod = '') {
  const method = String(paymentMethod || '').toUpperCase();
  if (method === 'STRIPE') return 'Stripe reference';
  if (method === 'TABBY') return 'Tabby reference';
  if (method === 'TAMARA') return 'Tamara reference';
  return 'Payment reference';
}
