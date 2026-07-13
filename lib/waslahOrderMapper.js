import {
  getDisplayOrderNumber,
  getOrderLineItemDisplayName,
  getOrderLineProduct,
} from '@/lib/orderDisplay';
import { buildEmxTrackingUrl } from '@/lib/waslahTracking';

const UAE_COUNTRY = 'ARE';
const DEFAULT_HS_CODE = '000000000000';
const DEFAULT_SENDER_EMAIL = 'support@store1920.com';

function normalizePhone(phone = '', phoneCode = '+971') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('971')) return `+${digits}`;
  const code = String(phoneCode || '+971').replace(/\D/g, '') || '971';
  const local = digits.replace(/^0+/, '');
  return `+${code}${local}`;
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function mapCountryCode(country = '') {
  const normalized = String(country || '').trim().toLowerCase();
  if (!normalized || normalized === 'uae' || normalized.includes('united arab emirates')) {
    return UAE_COUNTRY;
  }
  return String(country || UAE_COUNTRY).trim().toUpperCase();
}

function resolveOrderEmail(order = {}) {
  const addr = order.shippingAddress || {};
  return normalizeEmail(
    addr.email
    || order.guestEmail
    || order.userId?.email
    || '',
  );
}

function buildSender() {
  const senderId = String(process.env.WASLAH_SENDER_ID || '').trim();
  const senderEmail = normalizeEmail(process.env.WASLAH_SENDER_EMAIL || DEFAULT_SENDER_EMAIL);

  return {
    ...(senderId ? { _id: senderId } : {}),
    country: process.env.WASLAH_SENDER_COUNTRY || UAE_COUNTRY,
    contact_name: process.env.WASLAH_SENDER_CONTACT_NAME || 'Store1920',
    company_name: process.env.WASLAH_SENDER_COMPANY_NAME || process.env.WASLAH_SENDER_CONTACT_NAME || 'Store1920',
    phone: process.env.WASLAH_SENDER_PHONE || '',
    email: senderEmail,
    street1: process.env.WASLAH_SENDER_STREET || '',
    city: process.env.WASLAH_SENDER_CITY || 'Dubai',
    is_residential: false,
  };
}

function buildReceiver(order = {}) {
  const addr = order.shippingAddress || {};
  const name = String(addr.name || order.guestName || 'Customer').trim();
  const street = [
    addr.street,
    addr.building,
    addr.landmark,
    addr.district,
    addr.area,
    addr.state,
  ].filter(Boolean).join(', ');
  const receiverEmail = resolveOrderEmail(order);

  return {
    contact_name: name,
    company_name: name,
    phone: normalizePhone(addr.phone || order.guestPhone, addr.phoneCode || order.alternatePhoneCode || '+971'),
    ...(receiverEmail ? { email: receiverEmail } : {}),
    street1: street || 'Address not provided',
    city: String(addr.city || 'Dubai').trim(),
    zipcode: String(addr.zip || addr.pincode || '').trim(),
    country: mapCountryCode(addr.country),
    is_residential: false,
  };
}

function buildShipmentItems(order = {}) {
  const lines = Array.isArray(order.orderItems) && order.orderItems.length
    ? order.orderItems
    : (Array.isArray(order.items) ? order.items : []);

  if (!lines.length) {
    return [{
      name: 'Order items',
      description: 'Order items',
      origin_country: 'AE',
      hs_code: DEFAULT_HS_CODE,
      quantity: 1,
      unit_of_measurement: 'PCS',
      weight: { value: 0.5, unit: 'Kg' },
      price: { value: Number(order.total || 0), currency: 'AED' },
    }];
  }

  return lines.map((item) => {
    const product = getOrderLineProduct(item);
    const productName = String(
      getOrderLineItemDisplayName(item, product),
    ).trim().slice(0, 120) || 'Product';

    return {
      name: productName,
      description: productName,
      origin_country: 'AE',
      hs_code: DEFAULT_HS_CODE,
      quantity: Math.max(1, Number(item.quantity || 1)),
      unit_of_measurement: 'PCS',
      weight: { value: 0.25, unit: 'Kg' },
      price: {
        value: Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)),
        currency: 'AED',
      },
      ...(String(product?.sku || item?.sku || '').trim()
        ? { sku: String(product?.sku || item?.sku || '').trim().slice(0, 64) }
        : {}),
    };
  });
}

function buildShipmentDescription(items = []) {
  const names = items
    .map((item) => String(item?.name || item?.description || '').trim())
    .filter(Boolean);
  if (!names.length) return 'Store order';
  return names.join(', ').slice(0, 200);
}

function isCodOrder(order = {}) {
  return String(order.paymentMethod || '').toUpperCase() === 'COD';
}

export function validateWaslahOrderPayload(payload = {}) {
  const issues = [];

  if (!String(process.env.WASLAH_SENDER_ID || '').trim()) {
    issues.push('WASLAH_SENDER_ID is missing — add your Waslah sender address _id to .env');
  }
  if (!String(process.env.WASLAH_SENDER_PHONE || '').trim()) {
    issues.push('WASLAH_SENDER_PHONE is missing');
  }
  if (!String(process.env.WASLAH_SENDER_STREET || '').trim()) {
    issues.push('WASLAH_SENDER_STREET is missing');
  }
  if (!String(payload?.sender?._id || '').trim()) {
    issues.push('sender._id is required by Waslah');
  }
  if (!String(payload?.receiver?.phone || '').trim()) {
    issues.push('Customer phone is required in the shipping address');
  }
  if (!String(payload?.receiver?.street1 || '').trim() || payload.receiver.street1 === 'Address not provided') {
    issues.push('Complete customer shipping address is required');
  }
  if (!String(payload?.reference || '').trim()) {
    issues.push('Order reference is required');
  }
  if (!String(payload?.service_id || payload?.shipment?.service_id || process.env.WASLAH_SERVICE_ID || '').trim()) {
    issues.push('EMX service is not configured — set WASLAH_SERVICE_ID in .env or fetch services from Store Orders');
  }

  return issues;
}

/**
 * Map a Store1920 order into a Waslah create-order payload.
 */
export function buildWaslahCanonicalReference(order = {}) {
  const stored = String(order?.waslah?.reference || '').replace(/^#/, '').trim();
  if (stored) return stored;

  const orderNo = String(getDisplayOrderNumber(order) || order?.shortOrderNumber || '')
    .replace(/^#/, '')
    .trim();
  if (orderNo) return `S1920-${orderNo}`;

  const mongoId = String(order?._id || order?.id || '').trim();
  if (mongoId) return `S1920-${mongoId}`;
  return '';
}

export function buildWaslahOrderPayload(order = {}, { reference, serviceId } = {}) {
  const orderRef = reference
    || buildWaslahCanonicalReference(order)
    || getDisplayOrderNumber(order)
    || `ORDER_${String(order._id || '').slice(-8)}`;
  const paymentType = isCodOrder(order) ? 'COD' : 'PPD';
  const codAmount = paymentType === 'COD' ? Number(order.total || 0) : 0;
  const items = buildShipmentItems(order);
  const shipmentDescription = buildShipmentDescription(items);
  const totalWeight = items.reduce(
    (sum, item) => sum + Number(item.weight?.value || 0) * Number(item.quantity || 1),
    0,
  ) || 0.5;
  const resolvedServiceId = String(
    serviceId || process.env.WASLAH_SERVICE_ID || '',
  ).trim();

  return {
    order_type: 'delivery',
    reference: String(orderRef).replace(/^#/, ''),
    deleted: false,
    ...(resolvedServiceId ? { service_id: resolvedServiceId } : {}),
    shipment: {
      currency: 'AED',
      description: shipmentDescription,
      service_type: 'DOM',
      ...(resolvedServiceId ? { service_id: resolvedServiceId } : {}),
      payment_type: paymentType,
      quantity: 1,
      pieces: 1,
      is_document: false,
      weight: { value: Number(totalWeight.toFixed(2)) || 0.5, unit: 'Kg' },
      items,
      cod_amount: codAmount,
      delivery_method: 'hand_to_recipient',
      is_remote_area: false,
      is_dangerous_goods: false,
      inspection_allowed: false,
      itemization: items.length > 0,
      delivery_duty: 'DDU',
    },
    sender: buildSender(),
    receiver: buildReceiver(order),
    packages: [{
      weight: { value: Number(totalWeight.toFixed(2)) || 0.5, unit: 'Kg' },
      dimensions: {
        width: Number(process.env.WASLAH_DEFAULT_PKG_WIDTH || 30),
        height: Number(process.env.WASLAH_DEFAULT_PKG_HEIGHT || 10),
        length: Number(process.env.WASLAH_DEFAULT_PKG_LENGTH || 20),
        unit: 'cm',
      },
    }],
  };
}

export function buildDefaultPickupInfo(overrides = {}) {
  const defaults = getDefaultWaslahPickupInfo({}, new Date());

  return {
    type: 'pickup',
    pickup_date: overrides.pickup_date || defaults.pickup_date,
    pickup_time: overrides.pickup_time || defaults.pickup_time,
    pickup_vehicle: overrides.pickup_vehicle || defaults.pickup_vehicle,
  };
}

function getDubaiDate(now = new Date()) {
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMs + (4 * 3600000));
}

function formatPickupDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** UAE pickup defaults: van, afternoon-evening, next eligible day (skip Sunday; after 10:00 use next day). */
export function getDefaultWaslahPickupDate(now = new Date()) {
  const envDate = String(process.env.WASLAH_DEFAULT_PICKUP_DATE || '').trim();
  if (envDate) return envDate;

  const dubaiNow = getDubaiDate(now);
  const candidate = new Date(dubaiNow);
  const afterCutoff = dubaiNow.getHours() >= 10;
  const weekday = dubaiNow.getDay(); // 0 = Sunday, 6 = Saturday

  if (weekday === 6 && afterCutoff) {
    // Saturday after 10:00 AM → Monday (skip Sunday)
    candidate.setDate(candidate.getDate() + 2);
  } else if (afterCutoff) {
    candidate.setDate(candidate.getDate() + 1);
  }

  if (candidate.getDay() === 0) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return formatPickupDate(candidate);
}

export function getDefaultWaslahPickupInfo(overrides = {}, now = new Date()) {
  return {
    pickup_date: overrides.pickup_date || getDefaultWaslahPickupDate(now),
    pickup_time: overrides.pickup_time
      || String(process.env.WASLAH_DEFAULT_PICKUP_TIME || '').trim()
      || '14:00-21:00',
    pickup_vehicle: overrides.pickup_vehicle
      || String(process.env.WASLAH_DEFAULT_PICKUP_VEHICLE || '').trim()
      || 'van',
  };
}

export function buildWaslahStoreOrderUpdate(order = {}, {
  waslahOrderId,
  waslahServiceId,
  payload,
  trackingNumber,
  courierName,
  labelUrl,
  cartId,
  alreadyProcessed = false,
} = {}) {
  const shouldShip = order.status === 'ORDER_PLACED' || order.status === 'PROCESSING';
  const prevAwb = String(order.waslah?.trackingNumber || order.trackingId || '').trim();
  const nextAwb = String(trackingNumber || order.waslah?.trackingNumber || order.trackingId || '').trim();
  const awbChanged = Boolean(prevAwb) && Boolean(nextAwb) && prevAwb !== nextAwb;
  const shipmentConfirmed = Boolean(nextAwb) || Boolean(alreadyProcessed);

  return {
    trackingId: trackingNumber || order.trackingId || order.waslah?.trackingNumber || null,
    courier: courierName || order.courier || 'EMX',
    trackingUrl: buildEmxTrackingUrl(trackingNumber || order.trackingId || order.waslah?.trackingNumber) || order.trackingUrl || null,
    // Creating a draft Waslah order is not the same as shipping it. Advance the
    // store lifecycle only after Waslah confirms processing or returns an AWB.
    status: shouldShip && shipmentConfirmed ? 'SHIPPED' : order.status,
    waslah: {
      // Preserve live carrier status and automatic-shipping metadata while
      // refreshing shipment details.
      ...(order.waslah || {}),
      orderId: waslahOrderId,
      cartId: cartId || order.waslah?.cartId || null,
      serviceId: waslahServiceId || order.waslah?.serviceId || null,
      reference: payload?.reference || order.waslah?.reference || null,
      trackingNumber: trackingNumber || order.waslah?.trackingNumber || null,
      labelUrl: labelUrl || order.waslah?.labelUrl || null,
      // Waslah often returns a fresh label URL for the same AWB — do not clear "printed" for that.
      labelPrintedAt: awbChanged ? null : (order.waslah?.labelPrintedAt || null),
      processed: alreadyProcessed || Boolean(trackingNumber) || Boolean(order.waslah?.processed),
      processedAt: order.waslah?.processedAt || ((alreadyProcessed || trackingNumber) ? new Date() : null),
      unlinkedInWaslah: false,
      lastSubtag: order.waslah?.lastSubtag || null,
      lastSubtagMessage: order.waslah?.lastSubtagMessage || null,
    },
  };
}
