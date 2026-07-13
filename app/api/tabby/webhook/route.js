import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { getTabbyPayment } from '@/lib/tabby';
import { handlePaymentCancellationRecovery } from '@/lib/paymentCancellationRecovery';
import {
    blockReversedTabbyOrderPayment,
    finalizeTabbyOrderPayment,
    isTabbyPaymentFailed,
    isTabbyPaymentReversed,
    isTabbyPaymentSuccessful,
    parseTabbyPaymentRecord,
    parseTabbyWebhookPayload,
} from '@/lib/tabbyOrderPayment';
import { verifyTabbyWebhookRequest } from '@/lib/tabbyWebhookAuth';
import { resolveOrderMongoIdFromPaymentReference } from '@/lib/orderPaymentReference';

export async function POST(request) {
    try {
        if (!verifyTabbyWebhookRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 });
        }

        const body = await request.json();
        const parsed = parseTabbyWebhookPayload(body);
        const { status, paymentId, orderId } = parsed;

        if (!orderId && !paymentId) {
            return NextResponse.json({ error: 'Missing payment id and order reference' }, { status: 400 });
        }

        await connectDB();

        const linkedOrder = paymentId
            ? await Order.findOne({ tabbyPaymentId: paymentId }).select('_id').lean()
            : null;
        const mongoOrderId = linkedOrder?._id
            ? String(linkedOrder._id)
            : await resolveOrderMongoIdFromPaymentReference(orderId);
        if (!mongoOrderId) {
            console.warn('[tabby] webhook order not found:', paymentId || orderId);
            if (isTabbyPaymentReversed(parsed)) {
                throw new Error('Tabby reversal could not be linked to an order yet');
            }
            return NextResponse.json({ received: true });
        }

        if (isTabbyPaymentReversed(parsed)) {
            const reversal = await blockReversedTabbyOrderPayment(mongoOrderId, {
                paymentId,
                providerEventId: String(body?.event_id || body?.event?.id || '').trim(),
                source: 'signed_tabby_webhook_reversal',
            });
            if (!reversal?.blocked) {
                throw new Error(
                    `Tabby reversal is not yet authoritative (${reversal?.reason || 'unknown'})`,
                );
            }
        } else if (isTabbyPaymentSuccessful(parsed)) {
            await finalizeTabbyOrderPayment(mongoOrderId, {
                paymentId,
                providerEventId: String(body?.event_id || body?.event?.id || '').trim(),
                source: 'tabby_webhook',
            });
        } else if (isTabbyPaymentFailed(parsed) && paymentId) {
            // A delayed signed failure notification must not cancel an order
            // whose authoritative provider state later became captured.
            const providerPayment = await getTabbyPayment(paymentId);
            const providerRecord = parseTabbyPaymentRecord(providerPayment);
            if (isTabbyPaymentFailed(providerRecord)) {
                const groupOrders = await Order.find({ tabbyPaymentId: paymentId })
                    .select('_id')
                    .lean();
                const cancellationIds = groupOrders.length
                    ? groupOrders.map((order) => String(order._id))
                    : [String(mongoOrderId)];
                for (const cancellationOrderId of cancellationIds) {
                    await handlePaymentCancellationRecovery({
                        orderId: cancellationOrderId,
                        reason: `Tabby payment ${providerRecord.status || status}`,
                    });
                }
            }
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error('Tabby webhook error:', err);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
