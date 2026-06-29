import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { handlePaymentCancellationRecovery } from '@/lib/paymentCancellationRecovery';
import {
    finalizeTabbyOrderPayment,
    isTabbyPaymentFailed,
    isTabbyPaymentFullyCaptured,
    isTabbyPaymentSuccessful,
    parseTabbyWebhookPayload,
} from '@/lib/tabbyOrderPayment';
import { verifyTabbyWebhookRequest } from '@/lib/tabbyWebhookAuth';

export async function POST(request) {
    try {
        if (!verifyTabbyWebhookRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 });
        }

        const body = await request.json();
        const parsed = parseTabbyWebhookPayload(body);
        const { status, paymentId, orderId, captureTotal } = parsed;

        if (!orderId) {
            return NextResponse.json({ error: 'Missing order reference' }, { status: 400 });
        }

        await connectDB();

        if (isTabbyPaymentSuccessful(parsed)) {
            const order = await Order.findById(orderId).select('total').lean();
            await finalizeTabbyOrderPayment(orderId, {
                paymentId,
                skipCapture: status === 'closed' || isTabbyPaymentFullyCaptured({
                    captureTotal,
                    orderTotal: order?.total,
                }),
                source: 'tabby_webhook',
            });
        } else if (isTabbyPaymentFailed(parsed)) {
            await handlePaymentCancellationRecovery({
                orderId,
                reason: `Tabby payment ${status}`,
            });
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error('Tabby webhook error:', err);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
