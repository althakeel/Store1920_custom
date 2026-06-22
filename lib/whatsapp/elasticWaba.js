const DEFAULT_BASE_URL = 'https://wabacrmapi.elastic.ae/api/meta/v19.0';
const DEFAULT_PHONE_NUMBER_ID = '855078217693024';

const TEMPLATE_TOKENS = {
  order_confirmation_final: 'WABA_TOKEN_ORDER_CONFIRMATION',
  confirmation_paid_order: 'WABA_TOKEN_PAID_ORDER',
  order_shipped: 'WABA_TOKEN_SHIPPED',
  order_reminder_: 'WABA_TOKEN_REMINDER',
};

function isWhatsAppEnabled() {
  if (String(process.env.WABA_ENABLED || 'true').toLowerCase() === 'false') return false;
  return Boolean(process.env.WABA_API_TOKEN || resolveTokenForTemplate('order_confirmation_final'));
}

function resolveTokenForTemplate(templateName) {
  const envKey = TEMPLATE_TOKENS[templateName];
  if (envKey && process.env[envKey]) return process.env[envKey];
  return process.env.WABA_API_TOKEN || '';
}

function getMessagesUrl() {
  const baseUrl = String(process.env.WABA_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const phoneNumberId = String(process.env.WABA_PHONE_NUMBER_ID || DEFAULT_PHONE_NUMBER_ID).trim();
  return `${baseUrl}/${phoneNumberId}/messages`;
}

export function normalizePhoneForWaba(phone, phoneCode = '') {
  const combined = `${phoneCode || ''}${phone || ''}`.replace(/\D/g, '');
  if (!combined) return null;

  if (combined.startsWith('971')) return combined;
  if (combined.startsWith('91') && combined.length >= 12) return combined;
  if (combined.startsWith('0')) return `971${combined.replace(/^0+/, '')}`;
  if (combined.length === 9) return `971${combined}`;
  return combined;
}

function sanitizeTemplateText(value, maxLength = 1024) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export async function sendWhatsAppTemplate({
  to,
  phoneCode = '',
  templateName,
  bodyParams = [],
  languageCode = 'en',
  token,
}) {
  if (!isWhatsAppEnabled()) {
    return { skipped: true, reason: 'WhatsApp integration disabled or missing token' };
  }

  const recipient = normalizePhoneForWaba(to, phoneCode);
  if (!recipient) {
    return { skipped: true, reason: 'Missing or invalid phone number' };
  }

  const bearerToken = token || resolveTokenForTemplate(templateName);
  if (!bearerToken) {
    return { skipped: true, reason: 'Missing WABA API token' };
  }

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
      components: [
        {
          type: 'body',
          parameters: bodyParams.map((text) => ({
            type: 'text',
            text: sanitizeTemplateText(text),
          })),
        },
      ],
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
    throw new Error(errorMessage);
  }

  return {
    success: true,
    queueId: data?.message?.queue_id || null,
    status: data?.message?.message_status || null,
    raw: data,
  };
}
