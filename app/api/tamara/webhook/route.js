import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import {
    buildTamaraCaptureItemsFromOrder,
    captureTamaraPayment,
    extractTamaraWebhookToken,
    verifyTamaraWebhookToken,
} from '@/lib/tamara';
import { sendPaidOrderConfirmationNotifications } from '@/lib/orderConfirmationNotifications';
import { handlePaymentCancellationRecovery } from '@/lib/paymentCancellationRecovery';
import { markOrderPaymentSucceeded } from '@/lib/deferredOrderFlow';
import { recordPurchaseFromOrder } from '@/lib/serverCustomerTracking';
import { sendMetaPurchaseFromOrder } from '@/lib/metaConversionsApi';

const APPROVED_EVENTS = new Set(['order_approved', 'order_authorised']);
const CANCELLED_EVENTS = new Set(['order_declined', 'order_expired', 'order_canceled']);

async function finalizeTamaraPayment(orderId, tamaraOrderId, order) {
    if (!order || order.paymentStatus === 'PAID') {
        return order;
    }

    const updatedOrder = await markOrderPaymentSucceeded(orderId, { paymentStatus: 'PAID' });

    if (tamaraOrderId) {
        await Order.findByIdAndUpdate(orderId, { tamaraOrderId });
    }

    try {
        await recordPurchaseFromOrder({
            order: updatedOrder,
            trackingContext: updatedOrder.trackingContext || {},
            attribution: updatedOrder.attribution || {},
            userId: updatedOrder.userId || null,
            isGuest: Boolean(updatedOrder.isGuest),
            source: 'tamara_webhook',
        });
    } catch (trackingError) {
        console.error('Tamara purchase tracking failed for order', orderId, trackingError);
    }

    if (tamaraOrderId) {
        try {
            await captureTamaraPayment(tamaraOrderId, {
                orderId,
                amount: updatedOrder.total,
                items: buildTamaraCaptureItemsFromOrder(updatedOrder),
            });
        } catch (captureErr) {
            console.error('Tamara capture failed:', captureErr.message);
        }
    }

    try {
        const notificationResult = await sendPaidOrderConfirmationNotifications(orderId);
        console.log('[tamara] Paid confirmation notifications:', notificationResult);
    } catch (notificationError) {
        console.error('[tamara] Confirmation notifications failed:', notificationError);
    }

    try {
        await sendMetaPurchaseFromOrder(updatedOrder, { paymentMethod: 'TAMARA' });
    } catch (metaError) {
        console.error('[tamara] Meta purchase CAPI failed:', metaError);
    }

    return updatedOrder;
}

export async function POST(request) {
    try {
        const token = extractTamaraWebhookToken(request);
        if (!token) {
            return NextResponse.json({ error: 'Missing tamaraToken' }, { status: 401 });
        }

        const decoded = verifyTamaraWebhookToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
        }

        const body = await request.json();
        const eventType = String(body?.event_type || '').toLowerCase();
        const tamaraOrderId = body?.order_id || body?.order?.order_id || '';
        const orderId = body?.order_reference_id || body?.order?.reference_id || '';

        if (!orderId) {
            return NextResponse.json({ error: 'Missing order reference' }, { status: 400 });
        }

        await connectDB();

        if (APPROVED_EVENTS.has(eventType)) {
            const existing = await Order.findById(orderId)
                .populate('orderItems.productId')
                .lean();

            if (existing) {
                await finalizeTamaraPayment(orderId, tamaraOrderId, existing);
            }
        } else if (CANCELLED_EVENTS.has(eventType)) {
            const reasonMap = {
                order_declined: 'Tamara payment declined',
                order_expired: 'Tamara payment expired',
                order_canceled: 'Tamara payment canceled',
            };
            await handlePaymentCancellationRecovery({
                orderId,
                reason: reasonMap[eventType] || `Tamara payment ${eventType}`,
            });
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error('Tamara webhook error:', err);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
