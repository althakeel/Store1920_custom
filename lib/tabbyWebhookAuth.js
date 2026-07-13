/** Header name Tabby sends on each webhook POST (matches registration `header.title`). */
export function getTabbyWebhookHeaderName() {
    return String(process.env.TABBY_WEBHOOK_HEADER || 'x-tabby-signature').trim() || 'x-tabby-signature';
}

export function buildTabbyWebhookAuthHeader() {
    const secret = String(process.env.TABBY_WEBHOOK_SECRET || '').trim();
    if (!secret) return null;

    return {
        title: getTabbyWebhookHeaderName(),
        value: secret,
    };
}

export function verifyTabbyWebhookRequest(request) {
    const expected = String(process.env.TABBY_WEBHOOK_SECRET || '').trim();
    // A webhook without a configured shared secret cannot be authenticated.
    // Fail closed so a missing production setting never turns this endpoint
    // into a public payment-success callback.
    if (!expected) return false;

    const headerName = getTabbyWebhookHeaderName().toLowerCase();
    const customHeader = String(request.headers.get(headerName) || '').trim();
    if (customHeader && customHeader === expected) {
        return true;
    }

    const authHeader = String(request.headers.get('authorization') || '').trim();
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (bearer && bearer === expected) {
        return true;
    }

    return false;
}
