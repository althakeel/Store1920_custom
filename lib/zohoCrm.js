import Order from '@/models/Order';
import { getDisplayOrderNumber } from '@/lib/orderDisplay';
import { isZohoConfigured, zohoApiFetch } from '@/lib/zoho';
import { isAwaitingPaymentOrder } from '@/lib/deferredOrderStatus';
import { isFailedOrCancelledOrder } from '@/lib/orderConfirmationPolicy';

function isZohoCrmEnabled() {
  if (!isZohoConfigured()) return false;
  const flag = String(process.env.ZOHO_CRM_ENABLED || 'false').trim().toLowerCase();
  return flag !== 'false' && flag !== '0';
}

function splitName(fullName = '') {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: 'Customer', lastName: 'Store1920' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function normalizePhone(phone = '', phoneCode = '+971') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('971') && digits.length >= 11) return `+${digits}`;
  const code = String(phoneCode || '+971').replace(/\D/g, '') || '971';
  const local = digits.replace(/^0+/, '');
  return `+${code}${local}`;
}

function resolveOrderContact(order = {}) {
  const shipping = order.shippingAddress || {};
  const email = String(
    shipping.email || order.guestEmail || order.userId?.email || '',
  ).trim().toLowerCase();
  const phone = normalizePhone(
    shipping.phone || order.guestPhone,
    shipping.phoneCode || order.alternatePhoneCode || '+971',
  );
  const name = String(shipping.name || order.guestName || order.userId?.name || 'Customer').trim();
  const { firstName, lastName } = splitName(name);

  return {
    email,
    phone,
    firstName,
    lastName,
    fullName: name,
    city: String(shipping.city || '').trim(),
    state: String(shipping.state || shipping.district || '').trim(),
    street: String(shipping.street || '').trim(),
    country: String(shipping.country || 'UAE').trim(),
  };
}

function buildDealDescription(order = {}) {
  const lines = Array.isArray(order.orderItems) ? order.orderItems : [];
  const itemLines = lines.map((item) => {
    const qty = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    return `- ${item.name || 'Product'} x${qty} @ AED ${price.toFixed(2)}`;
  });

  return [
    `Store1920 order ${getDisplayOrderNumber(order) || order._id}`,
    `Payment: ${order.paymentMethod || 'N/A'}`,
    `Status: ${order.status || 'N/A'}`,
    `Total: AED ${Number(order.total || 0).toFixed(2)}`,
    itemLines.length ? `Items:\n${itemLines.join('\n')}` : '',
  ].filter(Boolean).join('\n');
}

async function zohoCrmRequest(path, { method = 'GET', body } = {}) {
  const res = await zohoApiFetch(path, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message
      || data?.data?.[0]?.message
      || data?.code
      || res.statusText;
    throw new Error(`Zoho CRM ${method} ${path} failed: ${message}`);
  }
  return data;
}

function extractRecordId(response = {}) {
  const row = Array.isArray(response?.data) ? response.data[0] : null;
  return row?.details?.id || row?.id || null;
}

async function upsertCrmContact(contact = {}) {
  if (!contact.email && !contact.phone) {
    throw new Error('Customer email or phone is required for Zoho CRM contact');
  }

  const record = {
    First_Name: contact.firstName,
    Last_Name: contact.lastName || '-',
    Email: contact.email || undefined,
    Phone: contact.phone || undefined,
    Mailing_Street: contact.street || undefined,
    Mailing_City: contact.city || undefined,
    Mailing_State: contact.state || undefined,
    Mailing_Country: contact.country || 'UAE',
    Lead_Source: 'Store1920',
  };

  const duplicateFields = contact.email ? ['Email'] : ['Phone'];
  const response = await zohoCrmRequest('/crm/v6/Contacts/upsert', {
    method: 'POST',
    body: {
      data: [record],
      duplicate_check_fields: duplicateFields,
    },
  });

  const contactId = extractRecordId(response);
  if (!contactId) {
    throw new Error('Zoho CRM contact upsert did not return an id');
  }
  return contactId;
}

async function createCrmDeal(order = {}, contactId) {
  const dealName = `Order ${getDisplayOrderNumber(order) || order._id}`;
  const closingDate = new Date(order.createdAt || Date.now()).toISOString().slice(0, 10);
  const stage = process.env.ZOHO_CRM_DEAL_STAGE || 'Qualification';

  const record = {
    Deal_Name: dealName,
    Stage: stage,
    Amount: Number(order.total || 0),
    Closing_Date: closingDate,
    Description: buildDealDescription(order),
    Contact_Name: { id: contactId },
  };

  const layoutId = String(process.env.ZOHO_CRM_DEAL_LAYOUT_ID || '').trim();
  if (layoutId) record.Layout = { id: layoutId };

  const response = await zohoCrmRequest('/crm/v6/Deals', {
    method: 'POST',
    body: { data: [record] },
  });

  const dealId = extractRecordId(response);
  if (!dealId) {
    throw new Error('Zoho CRM deal create did not return an id');
  }
  return dealId;
}

export function shouldSyncOrderToZohoCrm(order = {}) {
  if (!isZohoCrmEnabled()) return false;
  if (!order?._id) return false;
  if (isFailedOrCancelledOrder(order)) return false;
  if (isAwaitingPaymentOrder(order)) return false;
  if (order.zohoCrm?.dealId) return false;
  return true;
}

export async function syncOrderToZohoCrm(orderOrId, { force = false } = {}) {
  if (!isZohoCrmEnabled()) {
    return { skipped: true, reason: 'zoho_crm_disabled' };
  }

  const orderId = typeof orderOrId === 'string' ? orderOrId : orderOrId?._id;
  if (!orderId) {
    return { skipped: true, reason: 'order_not_found' };
  }

  const order = typeof orderOrId === 'object' && orderOrId?.orderItems
    ? orderOrId
    : await Order.findById(orderId).lean();

  if (!order) {
    return { skipped: true, reason: 'order_not_found' };
  }

  if (!force && !shouldSyncOrderToZohoCrm(order)) {
    if (order.zohoCrm?.dealId) return { skipped: true, reason: 'already_synced' };
    return { skipped: true, reason: 'order_not_eligible' };
  }

  const claim = await Order.findOneAndUpdate(
    {
      _id: orderId,
      ...(force ? {} : { 'zohoCrm.dealId': { $in: [null, ''] } }),
    },
    {
      $set: {
        'zohoCrm.syncStatus': 'syncing',
        'zohoCrm.lastError': null,
      },
    },
    { new: true },
  ).lean();

  if (!claim && !force) {
    return { skipped: true, reason: 'already_synced_or_in_progress' };
  }

  try {
    const contact = resolveOrderContact(order);
    const contactId = await upsertCrmContact(contact);
    const dealId = await createCrmDeal(order, contactId);

    await Order.findByIdAndUpdate(orderId, {
      $set: {
        zohoCrm: {
          contactId,
          dealId,
          syncedAt: new Date(),
          syncStatus: 'synced',
          lastError: null,
        },
      },
    });

    return { success: true, contactId, dealId };
  } catch (error) {
    const message = String(error?.message || error);
    await Order.findByIdAndUpdate(orderId, {
      $set: {
        'zohoCrm.syncStatus': 'failed',
        'zohoCrm.lastError': message,
      },
    });
    console.error('[zoho-crm] sync failed:', message);
    return { success: false, error: message };
  }
}

export async function syncOrderToZohoCrmOnce(orderOrId) {
  try {
    return await syncOrderToZohoCrm(orderOrId);
  } catch (error) {
    console.error('[zoho-crm] unexpected sync error:', error);
    return { success: false, error: error?.message || 'sync_failed' };
  }
}

export function getZohoCrmPublicConfig() {
  return {
    enabled: isZohoCrmEnabled(),
    dealStage: process.env.ZOHO_CRM_DEAL_STAGE || 'Qualification',
  };
}
