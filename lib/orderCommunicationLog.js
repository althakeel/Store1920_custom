import Order from '@/models/Order';

export const WHATSAPP_TEMPLATE_LABELS = {
  order_reminder: 'Order reminder (WhatsApp)',
  order_confirmation: 'Order confirmation (WhatsApp)',
  order_paid: 'Paid confirmation (WhatsApp)',
  order_shipped: 'Shipped update (WhatsApp)',
  order_delivered: 'Delivered update (WhatsApp)',
  promotional_offer: 'Promotional offer (WhatsApp)',
};

function normalizeLogEntry(entry = {}) {
  return {
    channel: entry.channel || 'system',
    template: entry.template || '',
    label: entry.label || entry.template || 'Notification',
    status: entry.status || 'sent',
    recipient: entry.recipient || '',
    sentByUid: entry.sentByUid || null,
    sentByName: entry.sentByName || 'System',
    details: entry.details || '',
    sentAt: entry.sentAt || entry.createdAt || null,
  };
}

export function synthesizeLegacyCommunicationEvents(order = {}) {
  const events = [];
  const email = order.guestEmail || order.shippingAddress?.email || order.userId?.email || '';

  if (order.orderPlacedEmailSentAt) {
    events.push({
      channel: 'email',
      template: 'order_placed',
      label: 'Order placed email',
      status: 'sent',
      recipient: email,
      sentByName: 'System',
      sentAt: order.orderPlacedEmailSentAt,
    });
  }

  if (order.orderConfirmedEmailSentAt) {
    events.push({
      channel: 'email',
      template: 'order_confirmed',
      label: 'Order confirmed email',
      status: 'sent',
      recipient: email,
      sentByName: 'System',
      sentAt: order.orderConfirmedEmailSentAt,
    });
  }

  if (order.adminOrderEmailSentAt) {
    events.push({
      channel: 'email',
      template: 'admin_order_copy',
      label: 'Admin order notification',
      status: 'sent',
      recipient: 'Admin inbox',
      sentByName: 'System',
      sentAt: order.adminOrderEmailSentAt,
    });
  }

  return events.map(normalizeLogEntry);
}

export function getOrderCommunicationHistory(order = {}) {
  const legacy = synthesizeLegacyCommunicationEvents(order);
  const logged = (Array.isArray(order.communicationLog) ? order.communicationLog : []).map(normalizeLogEntry);

  const seen = new Set();
  const merged = [...logged, ...legacy].filter((entry) => {
    const sentAtKey = entry.sentAt
      ? new Date(entry.sentAt).toISOString().slice(0, 16)
      : '';
    const key = [
      entry.channel,
      entry.template,
      entry.recipient,
      sentAtKey,
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return merged.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
}

export async function appendOrderCommunicationLog(orderId, entry = {}) {
  if (!orderId) return;

  const payload = {
    channel: entry.channel || 'system',
    template: String(entry.template || 'general'),
    label: String(entry.label || entry.template || 'Notification'),
    status: entry.status || 'sent',
    recipient: String(entry.recipient || ''),
    sentByUid: entry.sentByUid || null,
    sentByName: entry.sentByName || 'System',
    details: String(entry.details || ''),
    sentAt: entry.sentAt ? new Date(entry.sentAt) : new Date(),
  };

  try {
    await Order.findByIdAndUpdate(orderId, {
      $push: { communicationLog: payload },
    });
  } catch (error) {
    console.error('[orderCommunicationLog] append failed:', error);
  }
}
