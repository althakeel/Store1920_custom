const TABBY_API_URL = process.env.TABBY_API_URL || 'https://api.tabby.ai';
const TABBY_SECRET_KEY = process.env.TABBY_SECRET_KEY;

function tabbyHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TABBY_SECRET_KEY}`,
    };
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
