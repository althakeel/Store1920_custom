import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import User from "@/models/User";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sendPaidOrderConfirmationNotifications } from '@/lib/orderConfirmationNotifications';
import { recordPurchaseFromOrder } from "@/lib/serverCustomerTracking";
import { sendMetaPurchaseFromOrder } from '@/lib/metaConversionsApi';
import { finalizeAbandonedCartFromStripeSession } from '@/lib/abandonedCartConversion';
import { handlePaymentCancellationRecovery } from '@/lib/paymentCancellationRecovery';
import { markOrderPaymentSucceeded } from '@/lib/deferredOrderFlow';
import { finalizePrepaidUpsellPayment } from '@/lib/stripeOrderPayment';

export async function POST(request){
    try {
        const secret = process.env.STRIPE_SECRET_KEY
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
        if (!secret || !webhookSecret) {
            return NextResponse.json({ error: 'Stripe is disabled (missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET)' }, { status: 503 })
        }

        const stripe = new Stripe(secret)
        const body = await request.text()
        const sig = request.headers.get('stripe-signature')

        const event = stripe.webhooks.constructEvent(body, sig, webhookSecret)

        const markOrdersPaid = async (orderIds, userId) => {
            await dbConnect()
            await Promise.all(orderIds.map(async (orderId) => {
                const order = await markOrderPaymentSucceeded(orderId, { paymentStatus: 'PAID' })

                if (order) {
                    await Order.findByIdAndUpdate(orderId, {
                        stripePaymentStatus: 'paid',
                    });
                    try {
                        await recordPurchaseFromOrder({
                            order,
                            trackingContext: order.trackingContext || {},
                            attribution: order.attribution || {},
                            userId: userId || order.userId || null,
                            isGuest: Boolean(order.isGuest),
                            source: 'stripe_webhook',
                        })
                    } catch (trackingError) {
                        console.error('Stripe purchase tracking failed for order', orderId, trackingError)
                    }

                    try {
                        const notificationResult = await sendPaidOrderConfirmationNotifications(orderId)
                        console.log('[stripe] Paid confirmation notifications:', notificationResult)
                    } catch (notificationError) {
                        console.error('[stripe] Confirmation notifications failed for order', orderId, notificationError)
                    }

                    try {
                        await sendMetaPurchaseFromOrder(order, { paymentMethod: order.paymentMethod || 'STRIPE' })
                    } catch (metaError) {
                        console.error('[stripe] Meta purchase CAPI failed for order', orderId, metaError)
                    }
                }
            }))
            if (userId) {
                await User.findOneAndUpdate({ firebaseUid: userId }, { cart: {} })
            }
        }

        const cancelUnpaidOrders = async (orderIds, reason = 'Payment cancelled') => {
            await dbConnect()
            await Promise.all(orderIds.map(async (orderId) => {
                try {
                    await handlePaymentCancellationRecovery({ orderId, reason })
                } catch (error) {
                    console.error('[stripe] cancellation recovery failed for order', orderId, error)
                }
            }))
        }

        const extractMeta = (metadata = {}) => ({
            orderIds: (metadata.orderIds || '').split(',').filter(Boolean),
            userId: metadata.userId || null,
        })

        switch (event.type) {
            // Primary event: hosted Stripe Checkout session completed (payment captured)
            case 'checkout.session.completed': {
                const session = event.data.object
                await dbConnect()
                const recoveredCart = await finalizeAbandonedCartFromStripeSession(session)
                if (recoveredCart) break

                if (session.payment_status === 'paid') {
                    const { orderIds, userId } = extractMeta(session.metadata)
                    if (session.metadata?.prepaidUpsell === '1' && orderIds.length) {
                        await finalizePrepaidUpsellPayment(orderIds[0], session, { source: 'stripe_webhook_prepaid' })
                    } else if (orderIds.length) {
                        await markOrdersPaid(orderIds, userId)
                    }
                }
                break
            }

            // Async payment: session payment succeeded after initial pending state
            case 'checkout.session.async_payment_succeeded': {
                const session = event.data.object
                await dbConnect()
                const recoveredCart = await finalizeAbandonedCartFromStripeSession(session)
                if (recoveredCart) break

                const { orderIds, userId } = extractMeta(session.metadata)
                if (session.metadata?.prepaidUpsell === '1' && orderIds.length) {
                    await finalizePrepaidUpsellPayment(orderIds[0], session, { source: 'stripe_webhook_prepaid' })
                } else if (orderIds.length) {
                    await markOrdersPaid(orderIds, userId)
                }
                break
            }

            // Async payment failed: clean up orders
            case 'checkout.session.async_payment_failed': {
                const session = event.data.object
                const { orderIds } = extractMeta(session.metadata)
                if (orderIds.length) await cancelUnpaidOrders(orderIds, 'Payment failed')
                break
            }

            // Payment intent succeeded (for non-hosted integrations)
            case 'payment_intent.succeeded': {
                const pi = event.data.object
                const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id })
                const sess = sessions.data[0]
                if (sess) {
                    const { orderIds, userId } = extractMeta(sess.metadata)
                    if (orderIds.length) await markOrdersPaid(orderIds, userId)
                }
                break
            }

            // Payment intent canceled/failed
            case 'payment_intent.canceled':
            case 'payment_intent.payment_failed': {
                const pi = event.data.object
                const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id })
                const sess = sessions.data[0]
                if (sess) {
                    const { orderIds } = extractMeta(sess.metadata)
                    if (orderIds.length) await cancelUnpaidOrders(orderIds, 'Payment failed')
                }
                break
            }

            default:
                break
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('Stripe webhook error:', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
}

export const config = {
    api: { bodyparser: false }
}