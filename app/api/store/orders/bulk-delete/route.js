import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import authSeller from '@/middlewares/authSeller'
import { getAuth } from '@/lib/firebase-admin'
import Order from '@/models/Order'

export const runtime = 'nodejs'

async function getStoreIdFromRequest(request) {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const idToken = authHeader.replace('Bearer ', '')
  const decodedToken = await getAuth().verifyIdToken(idToken)
  return authSeller(decodedToken.uid)
}

export async function POST(request) {
  try {
    const storeId = await getStoreIdFromRequest(request)
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const orderIds = Array.isArray(body?.orderIds)
      ? [...new Set(body.orderIds.map((orderId) => String(orderId).trim()).filter(Boolean))]
      : []

    if (!orderIds.length) {
      return NextResponse.json({ error: 'Select at least one order to delete.' }, { status: 400 })
    }

    await connectDB()

    const result = await Order.deleteMany({
      _id: { $in: orderIds },
      storeId: String(storeId),
    })

    return NextResponse.json({
      success: true,
      deletedCount: Number(result?.deletedCount || 0),
      message: `Deleted ${Number(result?.deletedCount || 0)} order(s) successfully.`,
    })
  } catch (error) {
    console.error('[store orders bulk-delete POST] error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete selected orders' }, { status: 500 })
  }
}