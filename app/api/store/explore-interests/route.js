import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Store from '@/models/Store'
import authSeller from '@/middlewares/authSeller'
import { invalidateCachePattern } from '@/lib/cache'
import { getAuth } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

async function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const idToken = authHeader.split(' ')[1]
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
    const store = await Store.findById(storeId)
      .select('exploreInterestsEnabled exploreInterestsProductIds')
      .lean()

    return NextResponse.json({
      enabled: typeof store?.exploreInterestsEnabled === 'boolean' ? store.exploreInterestsEnabled : true,
      productIds: normalizeIds(store?.exploreInterestsProductIds),
    })
  } catch (error) {
    console.error('[explore interests GET] error:', error)
    return NextResponse.json({ error: 'Failed to load Explore Interests settings' }, { status: 500 })
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
    const updated = await Store.findByIdAndUpdate(
      storeId,
      { $set: { exploreInterestsEnabled: enabled, exploreInterestsProductIds: productIds } },
      { new: true }
    )

    invalidateCachePattern('public:explore-interests')

    return NextResponse.json({
      message: 'Saved',
      enabled,
      productIds,
      _storeId: updated?._id ? String(updated._id) : storeId,
    })
  } catch (error) {
    console.error('[explore interests POST] error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
