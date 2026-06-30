export function isWhatsAppAlreadySentError(message = '') {
  const text = String(message || '').toLowerCase();
  return text.includes('nothing to update')
    || text.includes('already sent')
    || text.includes('duplicate')
    || text.includes('already queued');
}

export function formatWhatsAppErrorMessage(error) {
  if (!error) return 'WhatsApp could not be sent';

  if (typeof error === 'object') {
    const nested = error.message || error.error || error.detail || error.description;
    if (nested && nested !== error) {
      return formatWhatsAppErrorMessage(nested);
    }
    try {
      return formatWhatsAppErrorMessage(JSON.stringify(error));
    } catch {
      return 'WhatsApp could not be sent';
    }
  }

  let text = String(error).trim();
  if (!text || text === 'null' || text === 'undefined') {
    return 'WhatsApp could not be sent';
  }

  text = text.replace(/^Error,\s*null,\s*/i, '').trim();

  if (isWhatsAppAlreadySentError(text)) {
    return 'WhatsApp reminder was already sent to this customer recently.';
  }

  return text;
}

export function parseWhatsAppApiError(data = {}, response = {}) {
  const candidates = [
    data?.message,
    typeof data?.error === 'object' ? data.error?.message : null,
    typeof data?.error === 'string' ? data.error : null,
    data?.error?.error_user_msg,
    data?.error?.error_user_title,
    response?.statusText,
  ]
    .map((value) => String(value || '').trim())
    .filter((value) => value && value !== 'null' && value !== 'undefined');

  const message = candidates[0] || 'WhatsApp API request failed';
  const friendly = formatWhatsAppErrorMessage(message);

  return {
    message: friendly,
    duplicate: isWhatsAppAlreadySentError(message) || isWhatsAppAlreadySentError(friendly),
    raw: message,
  };
}
