import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import User from "@/models/User";
import { NextResponse } from "next/server";
import Stripe from "stripe";

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
            await Promise.all(orderIds.map((orderId) =>
                Order.findByIdAndUpdate(orderId, {
                    paymentStatus: 'paid',
                    stripePaymentStatus: 'paid',
                })
            ))
            if (userId) {
                await User.findOneAndUpdate({ firebaseUid: userId }, { cart: {} })
            }
        }

        const deleteOrders = async (orderIds) => {
            await dbConnect()
            await Promise.all(orderIds.map((orderId) => Order.findByIdAndDelete(orderId)))
        }

        const extractMeta = (metadata = {}) => ({
            orderIds: (metadata.orderIds || '').split(',').filter(Boolean),
            userId: metadata.userId || null,
        })

        switch (event.type) {
            // Primary event: hosted Stripe Checkout session completed (payment captured)
            case 'checkout.session.completed': {
                const session = event.data.object
                if (session.payment_status === 'paid') {
                    const { orderIds, userId } = extractMeta(session.metadata)
                    if (orderIds.length) await markOrdersPaid(orderIds, userId)
                }
                break
            }

            // Async payment: session payment succeeded after initial pending state
            case 'checkout.session.async_payment_succeeded': {
                const session = event.data.object
                const { orderIds, userId } = extractMeta(session.metadata)
                if (orderIds.length) await markOrdersPaid(orderIds, userId)
                break
            }

            // Async payment failed: clean up orders
            case 'checkout.session.async_payment_failed': {
                const session = event.data.object
                const { orderIds } = extractMeta(session.metadata)
                if (orderIds.length) await deleteOrders(orderIds)
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
                    if (orderIds.length) await deleteOrders(orderIds)
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