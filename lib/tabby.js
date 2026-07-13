import { buildCheckoutRedirectUrl, resolveTamaraMerchantBaseUrl } from './checkoutOrigin';
import { buildTabbyWebhookAuthHeader } from './tabbyWebhookAuth';

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
    if (!data || typeof data !== 'object') return 'Unknown Tabby error';

    if (Array.isArray(data.errors) && data.errors.length > 0) {
        return data.errors
            .map((entry) => {
                const field = entry?.field || entry?.property || entry?.path;
                const message = entry?.message || entry?.error;
                if (field && message) return `${field}: ${message}`;
                return message || JSON.stringify(entry);
            })
            .join('; ');
    }

    return data?.message || data?.error || JSON.stringify(data);
}

export function normalizeTabbyPhone(phone, phoneCode = '') {
    const codeDigits = String(phoneCode || '').replace(/\D/g, '');
    let digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';

    if (digits.startsWith('00971')) digits = digits.slice(5);
    else if (digits.startsWith('971')) digits = digits.slice(3);
    else if (codeDigits === '971' && digits.startsWith('0')) digits = digits.slice(1);
    else if (codeDigits && !digits.startsWith(codeDigits)) digits = `${codeDigits}${digits}`;

    if (digits.startsWith('971')) digits = digits.slice(3);
    if (digits.length === 9 && digits.startsWith('5')) return digits;
    if (digits.length > 9 && digits.startsWith('05')) return digits.slice(1);
    return digits.length >= 9 ? digits : '';
}

const TABBY_REJECTION_MESSAGES = {
    not_available: 'Sorry, Tabby is unable to approve this purchase. Please choose another payment method.',
    order_amount_too_high: 'This purchase is above your current Tabby spending limit. Try a smaller order or another payment method.',
    order_amount_too_low: 'This purchase is below the minimum amount for Tabby.',
    currency_not_supported: 'Tabby is not available for this currency.',
};

export function formatTabbyRejectionMessage(reason = '') {
    const key = String(reason || '').trim().toLowerCase();
    if (!key) {
        return 'Tabby is not available for this order. Please choose another payment method.';
    }
    return TABBY_REJECTION_MESSAGES[key]
        || 'Tabby is not available for this order. Please choose another payment method.';
}

function extractTabbyWebUrl(data) {
    const direct = String(data?.web_url || '').trim();
    if (direct) return direct;

    const available = data?.configuration?.available_products;
    if (!available || typeof available !== 'object') return '';

    for (const products of Object.values(available)) {
        const entries = Array.isArray(products)
            ? products
            : (products && typeof products === 'object' && products.web_url ? [products] : []);
        for (const entry of entries) {
            const url = String(entry?.web_url || '').trim();
            if (url) return url;
        }
    }

    return '';
}

function extractTabbyRejectionReason(data) {
    const products = data?.configuration?.products;
    if (products && typeof products === 'object') {
        for (const entry of Object.values(products)) {
            const reason = String(entry?.rejection_reason || '').trim();
            if (reason) return reason;
        }
    }

    return String(data?.rejection_reason || '').trim();
}

function mapTabbyOrderStatus(status = '') {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'DELIVERED') return 'complete';
    if (normalized === 'CANCELLED' || normalized === 'RETURNED' || normalized === 'RTO' || normalized === 'RETURN' || normalized === 'PAYMENT_FAILED') {
        return 'canceled';
    }
    if (normalized === 'SHIPPED') return 'processing';
    return 'complete';
}

function mapTabbyPaymentMethod(method = '') {
    return String(method || '').toUpperCase() === 'COD' ? 'cod' : 'card';
}

export function buildTabbyBuyerHistory(userDoc, completedOrderCount = 0) {
    const registeredSince = userDoc?.createdAt
        ? new Date(userDoc.createdAt).toISOString()
        : new Date().toISOString();

    return {
        registered_since: registeredSince,
        loyalty_level: Math.max(0, Number(completedOrderCount) || 0),
        wishlist_count: 0,
        is_social_networks_connected: false,
        is_phone_number_verified: false,
        is_email_verified: Boolean(String(userDoc?.email || '').trim()),
    };
}

export function buildTabbyOrderHistoryEntries(orders = [], { buyer, shippingAddress } = {}) {
    const city = String(shippingAddress?.city || 'Dubai').trim() || 'Dubai';
    const address = String(
        shippingAddress?.address || shippingAddress?.street || shippingAddress?.line1 || city,
    ).trim() || city;
    const zip = String(shippingAddress?.zip || shippingAddress?.pincode || '00000').trim() || '00000';
    const phone = normalizeTabbyPhone(buyer?.phone, buyer?.phoneCode);
    const email = String(buyer?.email || '').trim();
    const name = String(buyer?.name || 'Customer').trim() || 'Customer';

    return (orders || []).map((order) => ({
        purchased_at: new Date(order.createdAt || Date.now()).toISOString(),
        amount: String(Number(order.total || 0).toFixed(2)),
        payment_method: mapTabbyPaymentMethod(order.paymentMethod),
        status: mapTabbyOrderStatus(order.status),
        buyer: {
            name,
            email,
            phone,
        },
        shipping_address: {
            city,
            address,
            zip,
        },
        items: (order.orderItems || []).map((item, index) => ({
            title: item?.productId?.name || item?.name || 'Product',
            description: item?.productId?.name || item?.name || 'Product',
            quantity: Number(item?.quantity || 1),
            unit_price: String(Number(item?.price || 0).toFixed(2)),
            reference_id: String(item?.productId?._id || item?.productId || item?.id || `item-${index + 1}`),
        })),
    }));
}

/** Public HTTPS URL Tabby should call for payment status updates. */
export function resolveTabbyWebhookUrl(request) {
    const explicit = String(process.env.TABBY_WEBHOOK_URL || '').trim();
    if (explicit) return explicit.replace(/\/+$/, '');

    const base = resolveTamaraMerchantBaseUrl(request);
    return buildCheckoutRedirectUrl(base, '/api/tabby/webhook');
}

export { buildTabbyWebhookAuthHeader } from './tabbyWebhookAuth';

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
    buyerHistory,
    orderHistory,
}) {
    assertTabbyConfigured();

    const normalizedPhone = normalizeTabbyPhone(buyer?.phone, buyer?.phoneCode);
    if (!normalizedPhone) {
        throw new Error('A valid UAE mobile number is required for Tabby checkout');
    }

    const email = String(buyer?.email || '').trim();
    if (!email) {
        throw new Error('An email address is required for Tabby checkout');
    }

    const city = String(shippingAddress?.city || 'Dubai').trim() || 'Dubai';
    const address = String(
        shippingAddress?.address || shippingAddress?.street || shippingAddress?.line1 || city,
    ).trim() || city;
    const zip = String(shippingAddress?.zip || shippingAddress?.pincode || '00000').trim() || '00000';

    const orderItems = (items || []).map((item, index) => ({
        title: String(item?.name || 'Product').slice(0, 255),
        description: String(item?.description || item?.name || 'Product').slice(0, 255),
        quantity: Math.max(1, Number(item?.quantity || 1)),
        unit_price: String(Number(item?.unit_price || item?.price || 0).toFixed(2)),
        reference_id: String(item?.sku || item?.productId || item?.id || `item-${index + 1}`),
    }));

    if (!orderItems.length) {
        throw new Error('Tabby checkout requires at least one order item');
    }

    const body = {
        payment: {
            amount: String(Number(amount).toFixed(2)),
            currency: 'AED',
            buyer: {
                email,
                phone: normalizedPhone,
                name: String(buyer?.name || 'Customer').trim() || 'Customer',
            },
            shipping_address: {
                city,
                address,
                zip,
            },
            order: {
                reference_id: String(orderId),
                updated_at: new Date().toISOString(),
                shipping_amount: '0.00',
                tax_amount: '0.00',
                discount_amount: '0.00',
                items: orderItems,
            },
            buyer_history: buyerHistory || buildTabbyBuyerHistory(null, 0),
            order_history: Array.isArray(orderHistory) ? orderHistory : [],
        },
        lang: 'en',
        merchant_code: TABBY_MERCHANT_CODE,
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`Tabby session error: ${formatTabbyError(data)}`);
    }

    const webUrl = extractTabbyWebUrl(data);
    const status = String(data?.status || '').trim().toLowerCase();
    const paymentId = data?.payment?.id || data?.id || '';

    if (!webUrl || status === 'rejected') {
        const rejectionReason = extractTabbyRejectionReason(data);
        console.error('[tabby] checkout session rejected:', {
            status,
            rejectionReason,
            paymentId,
            response: data,
        });
        throw new Error(formatTabbyRejectionMessage(rejectionReason));
    }

    return {
        web_url: webUrl,
        payment_id: paymentId,
        status,
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
