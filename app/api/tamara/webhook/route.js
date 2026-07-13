import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import {
    buildTamaraCaptureItemsFromOrder,
    captureTamaraPayment,
    extractTamaraWebhookToken,
    getTamaraOrder,
    verifyTamaraWebhookToken,
} from '@/lib/tamara';
import { sendPaidOrderConfirmationNotifications } from '@/lib/orderConfirmationNotifications';
import { handlePaymentCancellationRecovery } from '@/lib/paymentCancellationRecovery';
import { markOrderPaymentSucceeded } from '@/lib/deferredOrderFlow';
import { recordPurchaseFromOrder } from '@/lib/serverCustomerTracking';
import { sendMetaPurchaseFromOrder } from '@/lib/metaConversionsApi';
import { recordTrustedOrderPayment } from '@/lib/orderPaymentVerification';
import { blockOrdersForPaymentReversal } from '@/lib/orderPaymentReversal';
import {
    assertTamaraProviderOrder,
    getTamaraOrderGroupTotalInMinorUnits,
    getTamaraProviderRefundedAmountInMinorUnits,
    getTamaraProviderStatus,
    TAMARA_APPROVED_PROVIDER_STATUSES,
    TAMARA_CANCELLED_PROVIDER_STATUSES,
    TAMARA_CAPTURED_PROVIDER_STATUSES,
    TAMARA_REVERSED_PROVIDER_STATUSES,
    TamaraPaymentValidationError,
} from '@/lib/tamaraPaymentVerification';

const APPROVED_EVENTS = new Set(['order_approved', 'order_authorised']);
const CAPTURED_EVENTS = new Set(['order_captured', 'order_fully_captured']);
const CANCELLED_EVENTS = new Set(['order_declined', 'order_expired', 'order_canceled']);
const REVERSAL_EVENTS = new Set([
    'order_refunded',
    'order_partially_refunded',
    'order_fully_refunded',
    'order_chargeback',
    'order_disputed',
]);

function normalized(value) {
    return String(value || '').trim();
}

async function finalizeTamaraOrderGroup({
    orders,
    tamaraOrderId,
    orderReference,
    providerOrder,
}) {
    let verifiedProviderOrder = providerOrder;
    let providerStatus = getTamaraProviderStatus(verifiedProviderOrder);

    if (!TAMARA_CAPTURED_PROVIDER_STATUSES.has(providerStatus)) {
        const aggregateItems = orders.flatMap((order) => buildTamaraCaptureItemsFromOrder(order));
        const aggregateTotal = getTamaraOrderGroupTotalInMinorUnits(orders) / 100;

        try {
            await captureTamaraPayment(tamaraOrderId, {
                orderId: orderReference,
                amount: aggregateTotal,
                items: aggregateItems,
            });
        } catch (captureError) {
            // A duplicate approved webhook may race with the provider's captured
            // webhook. Re-read the authoritative provider record before failing.
            console.error('Tamara capture request failed:', captureError.message);
        }

        verifiedProviderOrder = await getTamaraOrder(tamaraOrderId);
        const validated = assertTamaraProviderOrder({
            providerOrder: verifiedProviderOrder,
            tamaraOrderId,
            orderReference,
            orders,
            allowedStatuses: TAMARA_CAPTURED_PROVIDER_STATUSES,
        });
        providerStatus = validated.providerStatus;
    }

    if (!TAMARA_CAPTURED_PROVIDER_STATUSES.has(providerStatus)) {
        throw new TamaraPaymentValidationError('Tamara payment is not fully captured', 409);
    }

    const finalizedOrders = [];
    for (const order of orders) {
        const mongoOrderId = String(order._id);
        const updatedOrder = await markOrderPaymentSucceeded(mongoOrderId, { paymentStatus: 'PAID' });
        if (!updatedOrder) {
            console.warn('[tamara] Ignoring payment success for inactive order:', mongoOrderId);
            continue;
        }

        await recordTrustedOrderPayment(mongoOrderId, {
            provider: 'TAMARA',
            providerReference: tamaraOrderId,
            providerEventId: providerStatus,
            source: 'tamara_server_verified_capture',
            verifiedAmount: updatedOrder.total,
            currency: 'AED',
        });

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
            console.error('Tamara purchase tracking failed for order', mongoOrderId, trackingError);
        }

        try {
            const notificationResult = await sendPaidOrderConfirmationNotifications(mongoOrderId);
            console.log('[tamara] Paid confirmation notifications:', notificationResult);
        } catch (notificationError) {
            console.error('[tamara] Confirmation notifications failed:', notificationError);
        }

        try {
            await sendMetaPurchaseFromOrder(updatedOrder, { paymentMethod: 'TAMARA' });
        } catch (metaError) {
            console.error('[tamara] Meta purchase CAPI failed:', metaError);
        }

        finalizedOrders.push(updatedOrder);
    }

    return finalizedOrders;
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
        const eventType = normalized(body?.event_type).toLowerCase();
        const tamaraOrderId = normalized(body?.order_id || body?.order?.order_id);
        const orderReference = normalized(
            body?.order_reference_id
            || body?.order?.order_reference_id
            || body?.order?.reference_id,
        );
        const handledEvent = APPROVED_EVENTS.has(eventType)
            || CAPTURED_EVENTS.has(eventType)
            || CANCELLED_EVENTS.has(eventType)
            || REVERSAL_EVENTS.has(eventType);

        if (!handledEvent) {
            return NextResponse.json({ received: true });
        }
        if (!tamaraOrderId) {
            return NextResponse.json({ error: 'Missing Tamara order id' }, { status: 400 });
        }
        if (!orderReference && !REVERSAL_EVENTS.has(eventType)) {
            return NextResponse.json({ error: 'Missing Tamara order reference' }, { status: 400 });
        }

        const tokenOrderId = normalized(decoded?.order_id || decoded?.order?.order_id);
        if (tokenOrderId && tokenOrderId !== tamaraOrderId) {
            return NextResponse.json({ error: 'Webhook token order mismatch' }, { status: 401 });
        }

        await connectDB();

        const orders = await Order.find({ tamaraOrderId })
            .populate('orderItems.productId')
            .lean();
        if (!orders.length) {
            throw new TamaraPaymentValidationError('Tamara order group was not found', 409);
        }

        // Never trust the signed webhook body as payment proof. Read the current
        // provider record for approved, captured, and cancellation events.
        const providerOrder = await getTamaraOrder(tamaraOrderId);
        const providerStatus = getTamaraProviderStatus(providerOrder);
        const refundedMinorUnits = getTamaraProviderRefundedAmountInMinorUnits(providerOrder);
        const providerPaymentReversed = TAMARA_REVERSED_PROVIDER_STATUSES.has(providerStatus)
            || refundedMinorUnits > 0;

        // A refund/dispute wins over a delayed approval/capture notification.
        // Keep the commercial order open for staff review, but revoke payment
        // trust so an EMX retry cannot ship it as prepaid.
        if (providerPaymentReversed) {
            assertTamaraProviderOrder({
                providerOrder,
                tamaraOrderId,
                orderReference,
                orders,
            });
            const groupTotalMinorUnits = getTamaraOrderGroupTotalInMinorUnits(orders);
            const isPartial = providerStatus.includes('partial')
                || (refundedMinorUnits > 0 && refundedMinorUnits < groupTotalMinorUnits);
            const isDispute = providerStatus.includes('disput') || providerStatus.includes('charge');
            await blockOrdersForPaymentReversal(
                orders.map((order) => String(order._id)),
                {
                    provider: 'TAMARA',
                    providerReference: tamaraOrderId,
                    providerEventId: normalized(body?.event_id || decoded?.jti || eventType),
                    source: `signed_tamara_${eventType}`,
                    paymentStatus: isDispute
                        ? 'DISPUTED'
                        : (isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED'),
                    reason: 'Tamara reported that the payment was refunded or reversed before fulfillment.',
                },
            );
            return NextResponse.json({ received: true, paymentReversed: true });
        }

        if (REVERSAL_EVENTS.has(eventType)) {
            // The signed notice arrived before Tamara's order lookup reflected
            // the reversal. Ask Tamara to retry instead of acknowledging it.
            throw new TamaraPaymentValidationError(
                `Tamara reversal is not yet visible (${providerStatus || 'unknown'})`,
                409,
            );
        }

        if (APPROVED_EVENTS.has(eventType) || CAPTURED_EVENTS.has(eventType)) {
            const allowedStatuses = CAPTURED_EVENTS.has(eventType)
                ? TAMARA_CAPTURED_PROVIDER_STATUSES
                : new Set([
                    ...TAMARA_APPROVED_PROVIDER_STATUSES,
                    ...TAMARA_CAPTURED_PROVIDER_STATUSES,
                ]);
            assertTamaraProviderOrder({
                providerOrder,
                tamaraOrderId,
                orderReference,
                orders,
                allowedStatuses,
            });
            await finalizeTamaraOrderGroup({
                orders,
                tamaraOrderId,
                orderReference,
                providerOrder,
            });
        } else if (CANCELLED_EVENTS.has(eventType)) {
            const cancellationValidation = assertTamaraProviderOrder({
                providerOrder,
                tamaraOrderId,
                orderReference,
                orders,
            });
            if (!TAMARA_CANCELLED_PROVIDER_STATUSES.has(cancellationValidation.providerStatus)) {
                // Provider GET is authoritative. Ignore an older decline/expiry
                // event if the order subsequently reached an approved/captured state.
                return NextResponse.json({
                    received: true,
                    ignored: true,
                    reason: `stale_cancellation_${cancellationValidation.providerStatus || 'unknown'}`,
                });
            }
            const reasonMap = {
                order_declined: 'Tamara payment declined',
                order_expired: 'Tamara payment expired',
                order_canceled: 'Tamara payment canceled',
            };
            for (const order of orders) {
                await handlePaymentCancellationRecovery({
                    orderId: String(order._id),
                    reason: reasonMap[eventType] || `Tamara payment ${eventType}`,
                });
            }
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error('Tamara webhook error:', err);
        return NextResponse.json(
            {
                error: err instanceof TamaraPaymentValidationError
                    ? err.message
                    : 'Webhook processing failed',
            },
            { status: err?.statusCode || 500 },
        );
    }
}
