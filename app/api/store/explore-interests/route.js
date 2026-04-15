import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Store from '@/models/Store'
import authSeller from '@/middlewares/authSeller'

export const dynamic = 'force-dynamic'

async function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const idToken = authHeader.split(' ')[1]
  const { getAuth } = await import('firebase-admin/auth')
  const { initializeApp, getApps } = await import('firebase-admin/app')
  if (getApps().length === 0) initializeApp()
  try {
    const decoded = await getAuth().verifyIdToken(idToken)
    return decoded.uid
  } catch {
    return null
  }
}

function normalizeIds(arr) {
  return Array.from(new Set(
    (Array.isArray(arr) ? arr : []).map((id) => String(id || '').trim()).filter(Boolean)
  ))
}

export async function GET(request) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const storeId = await authSeller(userId)
    if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

    await connectDB()
    // Read the exact same document the public API reads so values match.
    const store = await Store.findOne()
      .select('exploreInterestsEnabled exploreInterestsProductIds')
      .lean()

    return NextResponse.json({
      enabled: typeof store?.exploreInterestsEnabled === 'boolean' ? store.exploreInterestsEnabled : true,
      productIds: normalizeIds(store?.exploreInterestsProductIds),
    })
  } catch (error) {
    console.error('[explore interests GET] error:', error)
    return NextResponse.json({ enabled: true, productIds: [] })
  }
}

export async function POST(request) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const storeId = await authSeller(userId)
    if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

    const body = await request.json()
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : true
    const productIds = normalizeIds(body.productIds)

    await connectDB()
    // Write to the FIRST store document — the same one both GET routes always read.
    // This guarantees read/write consistency on single-store deployments.
    const updated = await Store.findOneAndUpdate(
      {},
      { $set: { exploreInterestsEnabled: enabled, exploreInterestsProductIds: productIds } },
      { new: true }
    )
    console.log('[explore interests POST] wrote to first store:', updated?._id, 'ids:', productIds.length, 'requested storeId was:', storeId)

    return NextResponse.json({ message: 'Saved', enabled, productIds, _storeId: updated?._id ? String(updated._id) : storeId })
  } catch (error) {
    console.error('[explore interests POST] error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
