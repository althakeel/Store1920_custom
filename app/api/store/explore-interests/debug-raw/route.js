import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Store from '@/models/Store'

export const dynamic = 'force-dynamic'

// Raw debug: shows exactly what's in DB for ALL stores.
// Access: /api/store/explore-interests/debug-raw
export async function GET() {
  try {
    await connectDB()

    const stores = await Store.find({})
      .select('_id name username isActive status exploreInterestsEnabled exploreInterestsProductIds updatedAt')
      .sort({ updatedAt: -1 })
      .lean()

    const firstByFindOne = await Store.findOne()
      .select('_id exploreInterestsProductIds')
      .lean()

    const firstWithData = await Store.findOne({ 'exploreInterestsProductIds.0': { $exists: true } })
      .select('_id exploreInterestsProductIds')
      .lean()

    return NextResponse.json({
      totalStores: stores.length,
      firstByFindOne: {
        _id: firstByFindOne?._id ? String(firstByFindOne._id) : null,
        productCount: (firstByFindOne?.exploreInterestsProductIds || []).length,
      },
      firstWithData: {
        _id: firstWithData?._id ? String(firstWithData._id) : null,
        productCount: (firstWithData?.exploreInterestsProductIds || []).length,
      },
      allStores: stores.map((s) => ({
        _id: String(s._id),
        name: s.name,
        username: s.username,
        status: s.status,
        isActive: s.isActive,
        exploreEnabled: s.exploreInterestsEnabled,
        productCount: (s.exploreInterestsProductIds || []).length,
        firstFewIds: (s.exploreInterestsProductIds || []).slice(0, 3),
        updatedAt: s.updatedAt,
      })),
    }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
