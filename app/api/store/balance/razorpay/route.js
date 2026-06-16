import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/firebase-admin'
import authSeller from '@/middlewares/authSeller'
import razorpay from '@/lib/razorpay'

const withTimeout = async (promise, timeoutMs, label) => {
    let timeoutId
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`))
        }, timeoutMs)
    })

    try {
        return await Promise.race([promise, timeoutPromise])
    } finally {
        clearTimeout(timeoutId)
    }
}

const formatBalance = (balancePayload) => {
    if (!balancePayload) return null

    const available = Array.isArray(balancePayload.available) ? balancePayload.available : []
    const pending = Array.isArray(balancePayload.pending) ? balancePayload.pending : []
    const currencyBalance = available.find((item) => item.currency === 'AED') || available.find((item) => item.currency === 'INR') || available[0]
    const pendingBalance = pending.find((item) => item.currency === 'AED') || pending.find((item) => item.currency === 'INR') || pending[0]
    const availableAmount = currencyBalance?.balance ? currencyBalance.balance / 100 : 0
    const pendingAmount = pendingBalance?.balance ? pendingBalance.balance / 100 : 0

    return {
        amount: availableAmount,
        currency: currencyBalance?.currency || 'AED',
        label: pendingBalance?.balance
            ? `Available balance (pending ${pendingAmount.toFixed(2)})`
            : 'Available balance'
    }
}

const formatSettlements = (settlements) => {
    if (!settlements || !Array.isArray(settlements.items)) return []

    return settlements.items.map((settlement) => ({
        id: settlement.id,
        reference: settlement.id,
        secondary: settlement.utr || settlement.narration || '',
        amount: (settlement.amount || 0) / 100,
        status: settlement.status || 'processed',
        created_at: settlement.created_at ? settlement.created_at * 1000 : null
    }))
}

export async function GET(request) {
    try {
        if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return NextResponse.json({
                success: true,
                provider: 'razorpay',
                balance: { amount: 0, currency: 'AED', label: 'Balance unavailable' },
                transactions: [],
                note: 'Razorpay keys are not configured for this environment.'
            })
        }

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

        let balanceFetch = null
        let settlementsFetch = null
        let note = ''

        if (typeof razorpay.balance?.fetch === 'function') {
            try {
                balanceFetch = await withTimeout(razorpay.balance.fetch(), 10000, 'Razorpay balance fetch')
            } catch (error) {
                note = error.message
            }
        }

        if (typeof razorpay.settlements?.all === 'function') {
            try {
                settlementsFetch = await withTimeout(razorpay.settlements.all({ count: 20 }), 10000, 'Razorpay settlements fetch')
            } catch (error) {
                note = note ? `${note} | ${error.message}` : error.message
            }
        }

        const balance = formatBalance(balanceFetch)
        const transactions = formatSettlements(settlementsFetch)

        if (!balanceFetch || !settlementsFetch) {
            return NextResponse.json({
                success: true,
                provider: 'razorpay',
                balance: balance || { amount: 0, currency: 'AED', label: 'Balance unavailable' },
                transactions,
                note: note || 'Razorpay balance API data is limited by account permissions.'
            })
        }

        return NextResponse.json({
            success: true,
            provider: 'razorpay',
            balance: {
                ...balance,
                lastUpdated: new Date().toISOString()
            },
            transactions
        })
    } catch (error) {
        console.error('[store/balance/razorpay API] Error:', error)
        return NextResponse.json({
            error: 'Failed to fetch Razorpay balance',
            message: error.message
        }, { status: 500 })
    }
}
