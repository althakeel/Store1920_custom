import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Store from '@/models/Store'
import { getCachedData, setCachedData } from '@/lib/cache'

export const dynamic = 'force-dynamic'

const CACHE_KEY = 'public:explore-interests:v1'
const CACHE_TTL = 120

function normalizeIds(arr) {
  return Array.from(new Set(
    (Array.isArray(arr) ? arr : []).map((id) => String(id || '').trim()).filter(Boolean)
  ))
}

export async function GET() {
  try {
    const cached = getCachedData(CACHE_KEY)
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
          'X-Cache': 'HIT',
        },
      })
    }

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
    const payload = {
      enabled: typeof store?.exploreInterestsEnabled === 'boolean' ? store.exploreInterestsEnabled : true,
      productIds,
      _storeId: store?._id ? String(store._id) : null,
    }

    setCachedData(CACHE_KEY, payload, CACHE_TTL)

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('[explore interests public GET] error:', error)
    return NextResponse.json({ enabled: true, productIds: [] })
  }
}
