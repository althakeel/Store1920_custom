import crypto from 'crypto';

const TAMARA_API_URL = process.env.TAMARA_API_URL || 'https://api-sandbox.tamara.co';
const TAMARA_API_TOKEN = process.env.TAMARA_API_TOKEN;
const TAMARA_NOTIFICATION_TOKEN = process.env.TAMARA_NOTIFICATION_TOKEN;

function tamaraHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TAMARA_API_TOKEN}`,
    };
}

/**
 * Create a Tamara checkout session
 * @param {Object} params
 * @param {string} params.orderId - Your internal order ID
 * @param {number} params.amount - Total amount (AED)
 * @param {Object} params.consumer - { first_name, last_name, email, phone_number }
 * @param {Object} params.shippingAddress - { first_name, last_name, line1, city, country_code, phone_number }
 * @param {Array}  params.items - [{ name, sku, quantity, unit_price: { amount, currency }, total_amount: { amount, currency } }]
 * @param {string} params.successUrl
 * @param {string} params.failureUrl
 * @param {string} params.cancelUrl
 * @param {string} params.notificationUrl
 * @returns {Promise<{ checkout_url: string, order_id: string }>}
 */
export async function createTamaraSession({
    orderId,
    amount,
    consumer,
    shippingAddress,
    items,
    successUrl,
    failureUrl,
    cancelUrl,
    notificationUrl,
    description = 'Order Payment',
}) {
    const body = {
        order_reference_id: String(orderId),
        total_amount: { amount: String(Number(amount).toFixed(2)), currency: 'AED' },
        description,
        country_code: 'AE',
        payment_type: 'PAY_BY_INSTALMENTS',
        locale: 'en_US',
        items: items.map(i => ({
            reference_id: String(i.sku || i.productId || i.id || ''),
            type: 'Digital',
            name: i.name || 'Product',
            sku: String(i.sku || i.productId || i.id || ''),
            quantity: i.quantity,
            unit_price: { amount: String(Number(i.unit_price).toFixed(2)), currency: 'AED' },
            total_amount: { amount: String(Number(i.total_amount).toFixed(2)), currency: 'AED' },
        })),
        consumer: {
            first_name: consumer.first_name || '',
            last_name: consumer.last_name || '',
            phone_number: consumer.phone_number || '',
            email: consumer.email || '',
        },
        billing_address: {
            first_name: shippingAddress.first_name || consumer.first_name || '',
            last_name: shippingAddress.last_name || consumer.last_name || '',
            line1: shippingAddress.line1 || shippingAddress.street || '',
            city: shippingAddress.city || '',
            country_code: 'AE',
            phone_number: shippingAddress.phone_number || consumer.phone_number || '',
        },
        shipping_address: {
            first_name: shippingAddress.first_name || consumer.first_name || '',
            last_name: shippingAddress.last_name || consumer.last_name || '',
            line1: shippingAddress.line1 || shippingAddress.street || '',
            city: shippingAddress.city || '',
            country_code: 'AE',
            phone_number: shippingAddress.phone_number || consumer.phone_number || '',
        },
        merchant_url: {
            success: successUrl,
            failure: failureUrl,
            cancel: cancelUrl,
            notification: notificationUrl,
        },
        tax_amount: { amount: '0.00', currency: 'AED' },
        shipping_amount: { amount: '0.00', currency: 'AED' },
        discount: { amount: '0.00', currency: 'AED', name: '' },
    };

    const res = await fetch(`${TAMARA_API_URL}/checkout`, {
        method: 'POST',
        headers: tamaraHeaders(),
        body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
        const msg = data?.message || data?.error_code || JSON.stringify(data);
        throw new Error(`Tamara session error: ${msg}`);
    }

    return {
        checkout_url: data.checkout_url,
        tamara_order_id: data.order_id,
    };
}

/**
 * Get Tamara order details
 */
export async function getTamaraOrder(tamaraOrderId) {
    const res = await fetch(`${TAMARA_API_URL}/orders/${tamaraOrderId}`, {
        headers: tamaraHeaders(),
    });
    return res.json();
}

/**
 * Capture a Tamara payment (call after order is approved)
 */
export async function captureTamaraPayment(tamaraOrderId, { orderId, amount }) {
    const body = {
        order_id: tamaraOrderId,
        captures: [{
            reference_id: String(orderId),
            total_amount: { amount: String(Number(amount).toFixed(2)), currency: 'AED' },
            tax_amount: { amount: '0.00', currency: 'AED' },
            shipping_amount: { amount: '0.00', currency: 'AED' },
            discount_amount: { amount: '0.00', currency: 'AED' },
            items: [],
        }],
    };

    const res = await fetch(`${TAMARA_API_URL}/payments/capture`, {
        method: 'POST',
        headers: tamaraHeaders(),
        body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
        const msg = data?.message || JSON.stringify(data);
        throw new Error(`Tamara capture error: ${msg}`);
    }
    return data;
}

/**
 * Cancel a Tamara order
 */
export async function cancelTamaraOrder(tamaraOrderId) {
    const res = await fetch(`${TAMARA_API_URL}/orders/${tamaraOrderId}/cancel`, {
        method: 'POST',
        headers: tamaraHeaders(),
        body: JSON.stringify({}),
    });
    return res.json();
}

/**
 * Verify Tamara webhook notification token (HS256 JWT)
 * The tamaraToken query param is a JWT signed with the Notification Token using HS256.
 */
export function verifyTamaraWebhookToken(token) {
    if (!TAMARA_NOTIFICATION_TOKEN) return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [header, payload, sig] = parts;
        const expected = crypto
            .createHmac('sha256', TAMARA_NOTIFICATION_TOKEN)
            .update(`${header}.${payload}`)
            .digest('base64url');
        if (expected !== sig) return null;
        return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}
