import { buildCheckoutRedirectUrl, resolveTamaraMerchantBaseUrl } from './checkoutOrigin';

const TABBY_API_URL = process.env.TABBY_API_URL || 'https://api.tabby.ai';
const TABBY_SECRET_KEY = process.env.TABBY_SECRET_KEY;
const TABBY_MERCHANT_CODE = process.env.TABBY_MERCHANT_CODE || 'Store1920';

function tabbyHeaders({ includeMerchantCode = false } = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TABBY_SECRET_KEY}`,
    };
    if (includeMerchantCode) {
        headers['X-Merchant-Code'] = TABBY_MERCHANT_CODE;
    }
    return headers;
}

function assertTabbyConfigured() {
    if (!TABBY_SECRET_KEY) {
        throw new Error('TABBY_SECRET_KEY is not configured');
    }
}

function formatTabbyError(data) {
    return data?.message || data?.error || JSON.stringify(data);
}

/** Public HTTPS URL Tabby should call for payment status updates. */
export function resolveTabbyWebhookUrl(request) {
    const explicit = String(process.env.TABBY_WEBHOOK_URL || '').trim();
    if (explicit) return explicit.replace(/\/+$/, '');

    const base = resolveTamaraMerchantBaseUrl(request);
    return buildCheckoutRedirectUrl(base, '/api/tabby/webhook');
}

function buildTabbyWebhookAuthHeader() {
    const secret = String(process.env.TABBY_WEBHOOK_SECRET || '').trim();
    if (!secret) return null;

    return {
        title: 'Authorization',
        value: `Bearer ${secret}`,
    };
}

/**
 * Register a Tabby webhook (POST /api/v1/webhooks).
 * @see https://docs.tabby.ai/api-reference/webhooks/register-a-webhook
 */
export async function registerTabbyWebhook({
    url,
    header,
    request,
} = {}) {
    assertTabbyConfigured();

    const body = {
        url: url || resolveTabbyWebhookUrl(request),
        header: header ?? buildTabbyWebhookAuthHeader(),
    };

    if (!body.url) {
        throw new Error('Tabby webhook URL is missing');
    }

    const res = await fetch(`${TABBY_API_URL}/api/v1/webhooks`, {
        method: 'POST',
        headers: tabbyHeaders({ includeMerchantCode: true }),
        body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Tabby webhook registration error: ${formatTabbyError(data)}`);
    }

    return data;
}

/**
 * List registered Tabby webhooks (GET /api/v1/webhooks).
 */
export async function listTabbyWebhooks() {
    assertTabbyConfigured();

    const res = await fetch(`${TABBY_API_URL}/api/v1/webhooks`, {
        headers: tabbyHeaders({ includeMerchantCode: true }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Tabby webhook list error: ${formatTabbyError(data)}`);
    }

    return data;
}

/**
 * Delete a Tabby webhook by ID (DELETE /api/v1/webhooks/{id}).
 */
export async function deleteTabbyWebhook(webhookId) {
    assertTabbyConfigured();

    const id = String(webhookId || '').trim();
    if (!id) {
        throw new Error('Tabby webhook id is required');
    }

    const res = await fetch(`${TABBY_API_URL}/api/v1/webhooks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: tabbyHeaders({ includeMerchantCode: true }),
    });

    if (res.status === 204) {
        return { deleted: true, id };
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`Tabby webhook delete error: ${formatTabbyError(data)}`);
    }

    return data;
}

/**
 * Create a Tabby checkout session.
 */
export async function createTabbySession({
    orderId,
    amount,
    buyer,
    shippingAddress,
    items,
    successUrl,
    cancelUrl,
    failureUrl,
}) {
    const body = {
        payment: {
            amount: String(Number(amount).toFixed(2)),
            currency: 'AED',
            buyer: {
                email: buyer?.email || '',
                phone: buyer?.phone || '',
                name: buyer?.name || 'Customer',
            },
            shipping_address: {
                city: shippingAddress?.city || '',
                address: shippingAddress?.address || shippingAddress?.line1 || '',
                zip: shippingAddress?.zip || '',
            },
            order: {
                reference_id: String(orderId),
                items: (items || []).map((item) => ({
                    title: item?.name || 'Product',
                    description: item?.description || item?.name || 'Product',
                    quantity: Number(item?.quantity || 1),
                    unit_price: String(Number(item?.unit_price || item?.price || 0).toFixed(2)),
                    reference_id: String(item?.sku || item?.productId || item?.id || ''),
                })),
            },
        },
        lang: 'en',
        merchant_code: process.env.TABBY_MERCHANT_CODE || 'Store1920',
        merchant_urls: {
            success: successUrl,
            cancel: cancelUrl,
            failure: failureUrl,
        },
    };

    const res = await fetch(`${TABBY_API_URL}/api/v2/checkout`, {
        method: 'POST',
        headers: tabbyHeaders(),
        body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
        const msg = data?.message || data?.error || JSON.stringify(data);
        throw new Error(`Tabby session error: ${msg}`);
    }

    return {
        web_url: data?.configuration?.available_products?.installments?.[0]?.web_url || data?.configuration?.available_products?.pay_later?.[0]?.web_url || data?.configuration?.available_products?.installments?.web_url || data?.web_url || '',
        payment_id: data?.payment?.id || data?.id || '',
        status: data?.status || data?.payment?.status || '',
        raw: data,
    };
}

/**
 * Retrieve a Tabby payment.
 */
export async function getTabbyPayment(paymentId) {
    const res = await fetch(`${TABBY_API_URL}/api/v2/payments/${paymentId}`, {
        headers: tabbyHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
        const msg = data?.message || data?.error || JSON.stringify(data);
        throw new Error(`Tabby payment fetch error: ${msg}`);
    }
    return data;
}

/**
 * Update a Tabby payment reference_id.
 * Tabby only updates order.reference_id on this endpoint.
 */
export async function updateTabbyPayment(paymentId, { referenceId }) {
    const body = {
        order: {
            reference_id: String(referenceId),
        },
    };

    const res = await fetch(`${TABBY_API_URL}/api/v2/payments/${paymentId}`, {
        method: 'PUT',
        headers: tabbyHeaders(),
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
        const msg = data?.message || data?.error || JSON.stringify(data);
        throw new Error(`Tabby update payment error: ${msg}`);
    }
    return data;
}

/**
 * Capture a Tabby payment.
 */
export async function captureTabbyPayment(paymentId, { amount }) {
    const body = {
        amount: String(Number(amount).toFixed(2)),
        currency: 'AED',
    };

    const res = await fetch(`${TABBY_API_URL}/api/v2/payments/${paymentId}/captures`, {
        method: 'POST',
        headers: tabbyHeaders(),
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
        const msg = data?.message || data?.error || JSON.stringify(data);
        throw new Error(`Tabby capture error: ${msg}`);
    }
    return data;
}
