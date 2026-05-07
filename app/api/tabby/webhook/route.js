import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { captureTabbyPayment, updateTabbyPayment } from '@/lib/tabby';

export async function POST(request) {
    try {
        const authHeader = request.headers.get('authorization') || '';
        const expected = process.env.TABBY_WEBHOOK_SECRET;

        if (expected) {
            const token = authHeader.replace(/^Bearer\s+/i, '').trim();
            if (!token || token !== expected) {
                return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 });
            }
        }

        const body = await request.json();
        const status = String(body?.status || body?.payment?.status || '').toLowerCase();
        const paymentId = body?.id || body?.payment?.id || '';
        const orderId = body?.order?.reference_id || body?.payment?.order?.reference_id || '';

        if (!orderId) {
            return NextResponse.json({ error: 'Missing order reference' }, { status: 400 });
        }

        await connectDB();

        if (status === 'authorized') {
            const order = await Order.findById(orderId);
            if (order && order.paymentStatus !== 'PAID') {
                order.paymentStatus = 'PAID';
                order.isPaid = true;
                if (paymentId) order.tabbyPaymentId = paymentId;
                await order.save();

                if (paymentId) {
                    try {
                        await updateTabbyPayment(paymentId, { referenceId: String(orderId) });
                    } catch (updateErr) {
                        console.error('Tabby update payment failed:', updateErr.message);
                    }

                    try {
                        await captureTabbyPayment(paymentId, { amount: order.total });
                    } catch (captureErr) {
                        console.error('Tabby capture failed:', captureErr.message);
                    }
                }
            }
        } else if (status === 'rejected' || status === 'expired' || status === 'closed') {
            await Order.findByIdAndUpdate(orderId, {
                paymentStatus: 'FAILED',
                isPaid: false,
                ...(paymentId ? { tabbyPaymentId: paymentId } : {}),
            });
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error('Tabby webhook error:', err);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
