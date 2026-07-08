import { getDisplayOrderNumber } from '@/lib/orderDisplay';

const UAE_COUNTRY = 'ARE';

function normalizePhone(phone = '', phoneCode = '+971') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('971')) return `+${digits}`;
  const code = String(phoneCode || '+971').replace(/\D/g, '') || '971';
  const local = digits.replace(/^0+/, '');
  return `+${code}${local}`;
}

function buildSender() {
  return {
    _id: process.env.WASLAH_SENDER_ID || undefined,
    country: process.env.WASLAH_SENDER_COUNTRY || UAE_COUNTRY,
    contact_name: process.env.WASLAH_SENDER_CONTACT_NAME || 'Store1920',
    company_name: process.env.WASLAH_SENDER_COMPANY_NAME || process.env.WASLAH_SENDER_CONTACT_NAME || 'Store1920',
    phone: process.env.WASLAH_SENDER_PHONE || '',
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
    addr.district,
    addr.area,
    addr.state,
  ].filter(Boolean).join(', ');

  return {
    contact_name: name,
    company_name: name,
    phone: normalizePhone(addr.phone || order.guestPhone, addr.phoneCode || order.alternatePhoneCode || '+971'),
    street1: street || 'Address not provided',
    city: String(addr.city || 'Dubai').trim(),
    zipcode: String(addr.zip || '').trim(),
    country: UAE_COUNTRY,
    is_residential: true,
  };
}

function buildShipmentItems(order = {}) {
  const lines = Array.isArray(order.orderItems) && order.orderItems.length
    ? order.orderItems
    : (Array.isArray(order.items) ? order.items : []);

  if (!lines.length) {
    return [{
      description: 'Order items',
      origin_country: 'AE',
      hs_code: '',
      quantity: 1,
      unit_of_measurement: 'PCS',
      weight: { value: 0.5, unit: 'Kg' },
      price: { value: Number(order.total || 0), currency: 'AED' },
    }];
  }

  return lines.map((item) => ({
    description: String(item.name || 'Product').slice(0, 120),
    origin_country: 'AE',
    hs_code: '',
    quantity: Math.max(1, Number(item.quantity || 1)),
    unit_of_measurement: 'PCS',
    weight: { value: 0.25, unit: 'Kg' },
    price: {
      value: Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)),
      currency: 'AED',
    },
  }));
}

function isCodOrder(order = {}) {
  return String(order.paymentMethod || '').toUpperCase() === 'COD';
}

/**
 * Map a Store1920 order into a Waslah create-order payload.
 */
export function buildWaslahOrderPayload(order = {}, { reference } = {}) {
  const orderRef = reference || getDisplayOrderNumber(order) || `ORDER_${String(order._id || '').slice(-8)}`;
  const paymentType = isCodOrder(order) ? 'COD' : 'PPD';
  const codAmount = paymentType === 'COD' ? Number(order.total || 0) : 0;
  const items = buildShipmentItems(order);
  const totalWeight = items.reduce(
    (sum, item) => sum + Number(item.weight?.value || 0) * Number(item.quantity || 1),
    0,
  ) || 0.5;

  return {
    order_type: 'delivery',
    reference: String(orderRef).replace(/^#/, ''),
    deleted: false,
    shipment: {
      currency: 'AED',
      description: items[0]?.description || 'Store order',
      service_type: 'DOM',
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
      itemization: false,
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
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const pickupDate = overrides.pickup_date
    || process.env.WASLAH_DEFAULT_PICKUP_DATE
    || tomorrow.toISOString().slice(0, 10);

  return {
    type: 'pickup',
    pickup_date: pickupDate,
    pickup_time: overrides.pickup_time || process.env.WASLAH_DEFAULT_PICKUP_TIME || '09:00-21:00',
    pickup_vehicle: overrides.pickup_vehicle || process.env.WASLAH_DEFAULT_PICKUP_VEHICLE || 'motorcycle',
  };
}
