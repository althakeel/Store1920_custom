const DEFAULT_BASE_URL = 'https://wabacrmapi.elastic.ae/api/meta/v19.0';
const DEFAULT_PHONE_NUMBER_ID = '855078217693024';

const TEMPLATE_TOKENS = {
  order_confirmation_final: 'WABA_TOKEN_ORDER_CONFIRMATION',
  confirmation_paid_order: 'WABA_TOKEN_PAID_ORDER',
  order_shipped: 'WABA_TOKEN_SHIPPED',
  order_reminder_: 'WABA_TOKEN_REMINDER',
  cart_reminder_1920: 'WABA_TOKEN_CART_REMINDER',
};

function hasAnyWabaToken() {
  return Boolean(
    process.env.WABA_API_TOKEN
    || process.env.WABA_TOKEN_ORDER_CONFIRMATION
    || process.env.WABA_TOKEN_PAID_ORDER
    || process.env.WABA_TOKEN_SHIPPED
    || process.env.WABA_TOKEN_REMINDER
    || process.env.WABA_TOKEN_CART_REMINDER
  );
}

function isWhatsAppEnabled() {
  if (String(process.env.WABA_ENABLED || 'true').toLowerCase() === 'false') return false;
  return hasAnyWabaToken();
}

function resolveTokenForTemplate(templateName) {
  if (process.env.WABA_API_TOKEN) return process.env.WABA_API_TOKEN;

  const normalized = String(templateName || '').trim();
  const envKey = TEMPLATE_TOKENS[normalized];
  if (envKey && process.env[envKey]) return process.env[envKey];

  if (normalized.includes('cart_reminder') && process.env.WABA_TOKEN_CART_REMINDER) {
    return process.env.WABA_TOKEN_CART_REMINDER;
  }

  if (normalized.includes('reminder') && process.env.WABA_TOKEN_REMINDER) {
    return process.env.WABA_TOKEN_REMINDER;
  }

  if (normalized.includes('shipped') && process.env.WABA_TOKEN_SHIPPED) {
    return process.env.WABA_TOKEN_SHIPPED;
  }

  if (normalized.includes('paid') && process.env.WABA_TOKEN_PAID_ORDER) {
    return process.env.WABA_TOKEN_PAID_ORDER;
  }

  if (normalized.includes('confirmation') && process.env.WABA_TOKEN_ORDER_CONFIRMATION) {
    return process.env.WABA_TOKEN_ORDER_CONFIRMATION;
  }

  return process.env.WABA_API_TOKEN || '';
}

function getMessagesUrl() {
  const fullUrl = String(process.env.WABA_MESSAGES_URL || '').trim();
  if (fullUrl) return fullUrl;

  const baseUrl = String(process.env.WABA_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const phoneNumberId = String(process.env.WABA_PHONE_NUMBER_ID || DEFAULT_PHONE_NUMBER_ID).trim();
  return `${baseUrl}/${phoneNumberId}/messages`;
}

export function normalizePhoneForWaba(phone, phoneCode = '') {
  const codeDigits = String(phoneCode || '').replace(/\D/g, '');
  const phoneDigits = String(phone || '').replace(/\D/g, '');
  let combined = phoneDigits;

  if (codeDigits && !phoneDigits.startsWith(codeDigits)) {
    combined = `${codeDigits}${phoneDigits}`;
  }

  if (!combined) return null;

  if (combined.startsWith('971')) {
    return combined.length === 12 ? combined : null;
  }

  if (combined.startsWith('91') && combined.length >= 12) return combined;

  if (combined.startsWith('0')) {
    const local = combined.replace(/^0+/, '');
    if (local.length === 9 && local.startsWith('5')) return `971${local}`;
    return null;
  }

  if (combined.length === 9 && combined.startsWith('5')) return `971${combined}`;

  return null;
}

function sanitizeTemplateText(value, maxLength = 1024) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function isValidHeaderImageUrl(url) {
  const value = String(url || '').trim();
  return /^https:\/\/.+/i.test(value);
}

export function resolveWhatsAppHeaderImage(primaryUrl, fallbackUrl = '') {
  if (isValidHeaderImageUrl(primaryUrl)) return primaryUrl.trim();
  if (isValidHeaderImageUrl(fallbackUrl)) return fallbackUrl.trim();
  return '';
}

function buildTemplateComponents({ bodyParams = [], headerImageUrl, buttonUrlSuffix }) {
  const components = [];

  if (isValidHeaderImageUrl(headerImageUrl)) {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: {
            link: headerImageUrl.trim(),
          },
        },
      ],
    });
  }

  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({
        type: 'text',
        text: sanitizeTemplateText(text),
      })),
    });
  }

  if (buttonUrlSuffix) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: 0,
      parameters: [
        {
          type: 'text',
          text: sanitizeTemplateText(buttonUrlSuffix, 256),
        },
      ],
    });
  }

  return components;
}

export async function sendWhatsAppTemplate({
  to,
  phoneCode = '',
  templateName,
  bodyParams = [],
  languageCode = 'en',
  token,
  headerImageUrl,
  buttonUrlSuffix,
}) {
  if (!isWhatsAppEnabled()) {
    console.warn('[whatsapp] skipped:', templateName, '— WABA tokens not configured in .env');
    return { skipped: true, reason: 'WhatsApp integration disabled or missing token' };
  }

  const recipient = normalizePhoneForWaba(to, phoneCode);
  if (!recipient) {
    console.warn('[whatsapp] skipped:', templateName, '— missing phone for recipient');
    return { skipped: true, reason: 'Missing or invalid phone number' };
  }

  if (recipient.startsWith('971') && recipient.length !== 12) {
    console.warn('[whatsapp] skipped:', templateName, '— invalid UAE number', recipient);
    return { skipped: true, reason: 'Invalid UAE phone number. Use 05xxxxxxxx format.' };
  }

  const bearerToken = token || resolveTokenForTemplate(templateName);
  if (!bearerToken) {
    console.warn('[whatsapp] skipped:', templateName, '— no bearer token for this template');
    return { skipped: true, reason: `Missing WABA API token for template ${templateName}` };
  }

  const components = buildTemplateComponents({
    bodyParams,
    headerImageUrl,
    buttonUrlSuffix,
  });

  const payload = {
    to: recipient,
    recipient_type: 'individual',
    type: 'template',
    template: {
      language: {
        policy: 'deterministic',
        code: languageCode,
      },
      name: templateName,
      ...(components.length > 0 ? { components } : {}),
    },
  };

  const response = await fetch(getMessagesUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = data?.error?.message || data?.message || response.statusText || 'WhatsApp API request failed';
    console.error('[whatsapp] API error:', templateName, recipient, errorMessage, data);
    throw new Error(errorMessage);
  }

  const queueStatus = data?.message?.message_status || null;
  console.log('[whatsapp] API response:', templateName, recipient, queueStatus, data?.message?.queue_id || '');

  return {
    success: true,
    queued: queueStatus === 'queued' || !queueStatus,
    delivered: queueStatus === 'sent' || queueStatus === 'delivered',
    queueId: data?.message?.queue_id || null,
    status: queueStatus,
    templateName,
    to: recipient,
    raw: data,
  };
}
