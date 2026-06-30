import AbandonedCart from '@/models/AbandonedCart';
import { sendAbandonedCartWhatsAppReminder } from '@/lib/whatsapp/abandonedCartMessaging';

export const ABANDONED_CART_WHATSAPP_DELAY_MS = Number(
  process.env.ABANDONED_CART_WHATSAPP_DELAY_MS
  || process.env.ABANDONED_CHECKOUT_WHATSAPP_DELAY_MS
  || 5 * 60 * 1000
);

const TRACKED_SOURCES = ['checkout', 'cart', 'guest-cart'];

export function isAbandonedCartWhatsAppAutoSendEnabled() {
  const raw = process.env.ABANDONED_CART_WHATSAPP_AUTO_SEND
    ?? process.env.ABANDONED_CHECKOUT_WHATSAPP_AUTO_SEND
    ?? 'true';
  const flag = String(raw).toLowerCase();
  return flag !== 'false' && flag !== '0';
}

export function getAbandonedCartWhatsAppDueAt(fromDate = new Date()) {
  return new Date(fromDate.getTime() + ABANDONED_CART_WHATSAPP_DELAY_MS);
}

export function getWhatsAppVariantForAbandonedSource(source = '') {
  return source === 'checkout' ? 'checkout' : 'cart';
}

export async function scheduleAbandonedCartWhatsAppReminder(filter, { now = new Date(), phone } = {}) {
  const normalizedPhone = String(phone || '').trim();
  if (!normalizedPhone || !isAbandonedCartWhatsAppAutoSendEnabled()) {
    return;
  }

  await AbandonedCart.updateOne(
    {
      ...filter,
      status: 'active',
      whatsappCheckoutReminderStatus: { $nin: ['sent', 'processing'] },
    },
    {
      $set: {
        whatsappCheckoutReminderDueAt: getAbandonedCartWhatsAppDueAt(now),
        whatsappCheckoutReminderStatus: 'pending',
        whatsappCheckoutReminderError: null,
      },
    }
  );
}

// Backward-compatible aliases
export const ABANDONED_CHECKOUT_WHATSAPP_DELAY_MS = ABANDONED_CART_WHATSAPP_DELAY_MS;
export const isAbandonedCheckoutWhatsAppAutoSendEnabled = isAbandonedCartWhatsAppAutoSendEnabled;
export const getAbandonedCheckoutWhatsAppDueAt = getAbandonedCartWhatsAppDueAt;

export async function processDueAbandonedCartWhatsAppReminders({ limit = 50 } = {}) {
  if (!isAbandonedCartWhatsAppAutoSendEnabled()) {
    return { processed: 0, results: [], disabled: true };
  }

  const now = new Date();
  const dueCarts = await AbandonedCart.find({
    status: 'active',
    source: { $in: TRACKED_SOURCES },
    phone: { $exists: true, $nin: [null, ''] },
    whatsappCheckoutReminderStatus: 'pending',
    whatsappCheckoutReminderDueAt: { $lte: now },
  })
    .sort({ whatsappCheckoutReminderDueAt: 1 })
    .limit(limit)
    .lean();

  const results = [];

  for (const dueCart of dueCarts) {
    const claimed = await AbandonedCart.findOneAndUpdate(
      {
        _id: dueCart._id,
        status: 'active',
        source: { $in: TRACKED_SOURCES },
        whatsappCheckoutReminderStatus: 'pending',
        whatsappCheckoutReminderDueAt: { $lte: now },
      },
      { $set: { whatsappCheckoutReminderStatus: 'processing' } },
      { new: true }
    ).lean();

    if (!claimed) continue;

    const variant = getWhatsAppVariantForAbandonedSource(claimed.source);
    const whatsapp = await sendAbandonedCartWhatsAppReminder(claimed, { variant });
    const sentAt = new Date();

    if (whatsapp?.success) {
      await AbandonedCart.updateOne(
        { _id: claimed._id },
        {
          $set: {
            whatsappCheckoutReminderStatus: 'sent',
            whatsappCheckoutReminderSentAt: sentAt,
            whatsappCheckoutReminderError: null,
          },
        }
      );
      results.push({ cartId: String(claimed._id), source: claimed.source, variant, success: true });
      continue;
    }

    const status = whatsapp?.skipped ? 'skipped' : 'failed';
    const error = whatsapp?.reason || whatsapp?.error || 'WhatsApp send failed';

    await AbandonedCart.updateOne(
      { _id: claimed._id },
      {
        $set: {
          whatsappCheckoutReminderStatus: status,
          whatsappCheckoutReminderError: error,
        },
      }
    );
    results.push({
      cartId: String(claimed._id),
      source: claimed.source,
      variant,
      success: false,
      status,
      error,
    });
  }

  return { processed: results.length, results };
}

export const processDueAbandonedCheckoutWhatsAppReminders = processDueAbandonedCartWhatsAppReminders;
