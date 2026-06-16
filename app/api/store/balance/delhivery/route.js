import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/firebase-admin'
import authSeller from '@/middlewares/authSeller'
import dbConnect from '@/lib/mongodb'
import Order from '@/models/Order'

const toAmount = (order) => {
    if (order?.delhivery?.payment?.cod_amount) {
        return Number(order.delhivery.payment.cod_amount || 0)
    }
    return Number(order?.total || 0)
}

export async function GET(request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 })
        }

        const idToken = authHeader.split(' ')[1]
        let decodedToken
        try {
            decodedToken = await getAuth().verifyIdToken(idToken)
        } catch (error) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
        }

        const storeId = await authSeller(decodedToken.uid)
        if (!storeId) {
            return NextResponse.json({ error: 'Unauthorized - not a seller' }, { status: 403 })
        }

        await dbConnect()

        const orders = await Order.find({
            storeId: storeId.toString(),
            'delhivery.payment.is_cod_recovered': true
        })
            .sort({ 'delhivery.payment.payment_collected_at': -1, updatedAt: -1 })
            .limit(20)
            .lean()

        const transactions = orders.map((order) => {
            const collectedAt = order?.delhivery?.payment?.payment_collected_at || order?.updatedAt
            return {
                id: order._id,
                reference: order.shortOrderNumber
                    ? `Order #${order.shortOrderNumber}`
                    : `Order ${order._id.toString().slice(-6).toUpperCase()}`,
                secondary: order.trackingId ? `Tracking ${order.trackingId}` : '',
                amount: toAmount(order),
                status: order?.delhivery?.payment?.payment_status || 'COLLECTED',
                created_at: collectedAt ? new Date(collectedAt).toISOString() : null
            }
        })

        const balanceAmount = transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0)

        return NextResponse.json({
            success: true,
            provider: 'delhivery',
            balance: {
                amount: balanceAmount,
                currency: 'AED',
                label: 'Collected COD total',
                lastUpdated: new Date().toISOString()
            },
            transactions,
            note: 'Balance reflects COD collections recorded from Delhivery tracking updates.'
        })
    } catch (error) {
        console.error('[store/balance/delhivery API] Error:', error)
        return NextResponse.json({
            error: 'Failed to fetch Delhivery balance',
            message: error.message
        }, { status: 500 })
    }
}
