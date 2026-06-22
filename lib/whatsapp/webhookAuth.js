export function getWebhookSecret() {
  return String(
    process.env.ORDER_CONFIRM_WEBHOOK_SECRET
    || process.env.WABA_WEBHOOK_SECRET
    || ''
  ).trim();
}

export function verifyWhatsAppWebhookRequest(request) {
  const expected = getWebhookSecret();
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: 'Webhook secret is not configured on the server',
    };
  }

  const authorization = String(request.headers.get('authorization') || '').trim();
  const bearerToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  const headerSecret = String(request.headers.get('x-webhook-secret') || '').trim();

  if (bearerToken === expected || headerSecret === expected) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 401,
    error: 'Unauthorized webhook request',
  };
}
