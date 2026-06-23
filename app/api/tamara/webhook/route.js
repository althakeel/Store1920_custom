import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { verifyTamaraWebhookToken, captureTamaraPayment } from '@/lib/tamara';
import { recordPurchaseFromOrder } from '@/lib/serverCustomerTracking';
import { sendDeferredPaymentWhatsApp } from '@/lib/whatsapp/orderNotifications';
import { sendMetaPurchaseFromOrder } from '@/lib/metaConversionsApi';

export async function POST(request) {
    try {
        // Tamara sends the notification token as a query param: ?tamaraToken=<jwt>
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('tamaraToken');

        if (!token) {
            return NextResponse.json({ error: 'Missing tamaraToken' }, { status: 401 });
        }

        const decoded = verifyTamaraWebhookToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
        }

        const body = await request.json();
        const { event_type, order_id: tamaraOrderId, order_reference_id: orderId } = body;

        await connectDB();

        if (event_type === 'order_approved') {
            // Find and update the order
            const order = await Order.findById(orderId);
            if (order && order.paymentStatus !== 'PAID') {
                order.paymentStatus = 'PAID';
                order.isPaid = true;
                order.tamaraOrderId = tamaraOrderId;
                await order.save();

                try {
                    await recordPurchaseFromOrder({
                        order,
                        trackingContext: order.trackingContext || {},
                        attribution: order.attribution || {},
                        userId: order.userId || null,
                        isGuest: Boolean(order.isGuest),
                        source: 'tamara_webhook',
                    });
                } catch (trackingError) {
                    console.error('Tamara purchase tracking failed for order', orderId, trackingError);
                }

                // Capture the payment at Tamara
                try {
                    await captureTamaraPayment(tamaraOrderId, {
                        orderId,
                        amount: order.total,
                    });
                } catch (captureErr) {
                    console.error('Tamara capture failed:', captureErr.message);
                    // Non-fatal: order is approved, capture can be retried
                }

                try {
                    const whatsappResult = await sendDeferredPaymentWhatsApp(order);
                    console.log('[tamara] WhatsApp paid confirmation:', whatsappResult);
                } catch (whatsappError) {
                    console.error('[tamara] WhatsApp failed:', whatsappError);
                }

                try {
                    await sendMetaPurchaseFromOrder(order, { paymentMethod: 'TAMARA' });
                } catch (metaError) {
                    console.error('[tamara] Meta purchase CAPI failed:', metaError);
                }
            }
        } else if (event_type === 'order_declined' || event_type === 'order_expired') {
            await Order.findByIdAndUpdate(orderId, {
                paymentStatus: 'FAILED',
                isPaid: false,
            });
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error('Tamara webhook error:', err);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
