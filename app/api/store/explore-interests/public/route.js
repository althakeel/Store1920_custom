import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Store from '@/models/Store'

export const dynamic = 'force-dynamic'

function normalizeIds(arr) {
  return Array.from(new Set(
    (Array.isArray(arr) ? arr : []).map((id) => String(id || '').trim()).filter(Boolean)
  ))
}

export async function GET() {
  try {
    await connectDB()

    // Prefer a store that already has explore selections saved; fall back to the first store.
    let store = await Store.findOne({ 'exploreInterestsProductIds.0': { $exists: true } })
      .select('_id exploreInterestsEnabled exploreInterestsProductIds')
      .lean()

    if (!store) {
      store = await Store.findOne()
        .select('_id exploreInterestsEnabled exploreInterestsProductIds')
        .lean()
    }

    const productIds = normalizeIds(store?.exploreInterestsProductIds)
    console.log('[explore interests public GET] storeId:', store?._id, 'productIds count:', productIds.length)

    return NextResponse.json({
      enabled: typeof store?.exploreInterestsEnabled === 'boolean' ? store.exploreInterestsEnabled : true,
      productIds,
      _storeId: store?._id ? String(store._id) : null,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
    })
  } catch (error) {
    console.error('[explore interests public GET] error:', error)
    return NextResponse.json({ enabled: true, productIds: [] })
  }
}
