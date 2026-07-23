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
import {
    finalizePrepaidUpsellPayment,
    validateStripePaidCheckoutSession,
    validateStripePaidSessionForOrders,
} from '@/lib/stripeOrderPayment';
import { recordTrustedOrderPayment } from '@/lib/orderPaymentVerification';
import { blockOrdersForPaymentReversal } from '@/lib/orderPaymentReversal';
import { logPaymentEvent } from '@/lib/paymentTransactionLog';

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

        const markOrdersPaid = async (orderIds, userId, session = null) => {
            await dbConnect()
            const sessionValidation = await validateStripePaidCheckoutSession(session, {
                stripeClient: stripe,
            })
            if (!sessionValidation.valid) {
                throw new Error(`Stripe Checkout verification failed: ${sessionValidation.reason}`)
            }
            const authoritativeSession = sessionValidation.session
            const authoritativeOrderIds = sessionValidation.orderIds
            const requestedIds = [...new Set(orderIds.map((value) => String(value).trim()).filter(Boolean))]
            if (
                requestedIds.length !== authoritativeOrderIds.length
                || requestedIds.some((orderId) => !authoritativeOrderIds.includes(orderId))
            ) {
                throw new Error('Stripe event order metadata changed before authoritative verification')
            }

            await Promise.all(authoritativeOrderIds.map(async (orderId) => {
                const order = await markOrderPaymentSucceeded(orderId, { paymentStatus: 'PAID' })

                if (!order) {
                    const latest = await Order.findById(orderId).select('isPaid paymentStatus status deletedAt').lean()
                    const alreadyPaid = latest?.isPaid === true
                        || String(latest?.paymentStatus || '').toUpperCase() === 'PAID'
                    if (!alreadyPaid) {
                        throw new Error(`Stripe paid session could not mark order ${orderId} as paid (status=${latest?.status || 'missing'})`)
                    }
                    return
                }

                const proof = await recordTrustedOrderPayment(orderId, {
                    provider: 'STRIPE',
                    providerReference: authoritativeSession.id,
                    providerEventId: sessionValidation.paymentIntentId || event?.id || '',
                    source: 'signed_stripe_webhook',
                    verifiedAmount: order.total,
                    currency: authoritativeSession?.currency || 'AED',
                    allowUnenrolledWithoutAutoShipment: true,
                });
                if (proof?.verified !== true) {
                    throw new Error(`Could not persist trusted Stripe proof for ${orderId}: ${proof?.reason || 'unknown'}`)
                }
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
            }))
            if (userId) {
                await User.findOneAndUpdate({ firebaseUid: userId }, { cart: {} })
            }
        }

        const cancelUnpaidOrders = async (orderIds, reason = 'Payment cancelled', session = null) => {
            await dbConnect()
            // Never cancel from a failure event if Checkout session is already paid
            // (customer can retry and succeed after an earlier PI failure).
            if (session?.id) {
                try {
                    const live = await stripe.checkout.sessions.retrieve(session.id)
                    if (String(live?.payment_status || '').toLowerCase() === 'paid') {
                        const { orderIds: paidOrderIds, userId } = extractMeta(live.metadata)
                        if (paidOrderIds.length) {
                            await markOrdersPaid(paidOrderIds, userId, live)
                        }
                        return
                    }
                } catch (sessionError) {
                    console.error('[stripe] cancel-time session check failed:', sessionError)
                }
            }
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

        const resolveStripeReversalContext = async (object = {}) => {
            await dbConnect()
            let paymentIntentId = String(
                typeof object?.payment_intent === 'string'
                    ? object.payment_intent
                    : object?.payment_intent?.id || '',
            ).trim()
            let charge = null

            const chargeId = String(
                typeof object?.charge === 'string'
                    ? object.charge
                    : object?.charge?.id || (object?.object === 'charge' ? object?.id : ''),
            ).trim()
            if ((!paymentIntentId || object?.object !== 'charge') && chargeId) {
                charge = await stripe.charges.retrieve(chargeId)
                paymentIntentId = paymentIntentId || String(
                    typeof charge?.payment_intent === 'string'
                        ? charge.payment_intent
                        : charge?.payment_intent?.id || '',
                ).trim()
            } else if (object?.object === 'charge') {
                charge = object
            }

            if (!paymentIntentId) return null
            const sessions = await stripe.checkout.sessions.list({
                payment_intent: paymentIntentId,
                limit: 10,
            })
            const session = sessions.data.find((entry) => extractMeta(entry.metadata).orderIds.length)
            if (!session) return null

            const { orderIds } = extractMeta(session.metadata)
            const orders = await Order.find({ _id: { $in: orderIds } }).select('_id total').lean()
            const validation = validateStripePaidSessionForOrders(session, orders)
            if (!validation.valid) {
                throw new Error(`Stripe reversal order verification failed: ${validation.reason}`)
            }

            return { session, orderIds: validation.orderIds, charge, paymentIntentId }
        }

        const blockStripeReversal = async (object, {
            paymentStatus,
            reason,
        }) => {
            const context = await resolveStripeReversalContext(object)
            if (!context) {
                throw new Error(`Could not link Stripe payment reversal to a Checkout session (${event.id})`)
            }
            await blockOrdersForPaymentReversal(context.orderIds, {
                provider: 'STRIPE',
                providerReference: context.session.id,
                providerEventId: event.id,
                source: `signed_stripe_${event.type}`,
                paymentStatus,
                reason,
            })
            await Promise.all((context.orderIds || []).map((orderId) => logPaymentEvent({
                orderId,
                eventType: String(paymentStatus || '').includes('DISPUTE') || event.type.includes('dispute')
                    ? 'DISPUTE'
                    : 'REVERSAL',
                provider: 'STRIPE',
                providerReference: context.session.id,
                status: paymentStatus,
                meta: { eventType: event.type, reason, eventId: event.id },
            })))
        }

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
                        const result = await finalizePrepaidUpsellPayment(orderIds[0], session, {
                            source: 'stripe_webhook_prepaid',
                            stripeClient: stripe,
                        })
                        if (result?.success !== true) throw new Error(`Stripe prepaid finalization failed: ${result?.reason || 'unknown'}`)
                    } else if (orderIds.length) {
                        await markOrdersPaid(orderIds, userId, session)
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
                    const result = await finalizePrepaidUpsellPayment(orderIds[0], session, {
                        source: 'stripe_webhook_prepaid',
                        stripeClient: stripe,
                    })
                    if (result?.success !== true) throw new Error(`Stripe prepaid finalization failed: ${result?.reason || 'unknown'}`)
                } else if (orderIds.length) {
                    await markOrdersPaid(orderIds, userId, session)
                }
                break
            }

            // Async payment failed: clean up orders
            case 'checkout.session.async_payment_failed': {
                const session = event.data.object
                const { orderIds } = extractMeta(session.metadata)
                if (orderIds.length) await cancelUnpaidOrders(orderIds, 'Payment failed', session)
                break
            }

            // Payment intent succeeded (for non-hosted integrations)
            case 'payment_intent.succeeded': {
                const pi = event.data.object
                const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id })
                const sess = sessions.data[0]
                if (sess) {
                    const { orderIds, userId } = extractMeta(sess.metadata)
                    if (sess.metadata?.prepaidUpsell === '1' && orderIds.length) {
                        const result = await finalizePrepaidUpsellPayment(orderIds[0], sess, {
                            source: 'stripe_webhook_prepaid',
                            stripeClient: stripe,
                        })
                        if (result?.success !== true) throw new Error(`Stripe prepaid finalization failed: ${result?.reason || 'unknown'}`)
                    } else if (orderIds.length) {
                        await markOrdersPaid(orderIds, userId, sess)
                    }
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
                    if (orderIds.length) await cancelUnpaidOrders(orderIds, 'Payment failed', sess)
                }
                break
            }

            // A successful refund makes the original captured amount
            // insufficient for every order in the Checkout split group.
            case 'charge.refunded': {
                const charge = event.data.object
                const original = Number(charge?.amount || 0)
                const refunded = Number(charge?.amount_refunded || 0)
                if (refunded > 0) {
                    const fullyRefunded = original > 0 && refunded >= original
                    await blockStripeReversal(charge, {
                        paymentStatus: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
                        reason: fullyRefunded
                            ? 'Stripe payment was fully refunded before fulfillment.'
                            : 'Stripe payment was partially refunded before fulfillment.',
                    })
                }
                break
            }

            case 'refund.created':
            case 'refund.updated': {
                const refund = event.data.object
                if (String(refund?.status || '').toLowerCase() === 'succeeded') {
                    await blockStripeReversal(refund, {
                        paymentStatus: 'REFUNDED',
                        reason: 'Stripe confirmed a refund before fulfillment.',
                    })
                }
                break
            }

            case 'charge.dispute.created':
            case 'charge.dispute.updated':
            case 'charge.dispute.closed':
            case 'charge.dispute.funds_withdrawn': {
                const dispute = event.data.object
                if (String(dispute?.status || '').toLowerCase() !== 'won') {
                    await blockStripeReversal(dispute, {
                        paymentStatus: 'DISPUTED',
                        reason: 'Stripe reported a payment dispute before fulfillment.',
                    })
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
