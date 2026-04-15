import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Store from '@/models/Store'

export const dynamic = 'force-dynamic'

// Debug-only endpoint. Shows raw DB state for all stores' explore fields.
export async function GET() {
  try {
    await connectDB()
    const stores = await Store.find()
      .select('_id name username isActive status exploreInterestsEnabled exploreInterestsProductIds updatedAt')
      .sort({ updatedAt: -1 })
      .lean()

    return NextResponse.json({
      total: stores.length,
      stores: stores.map((s) => ({
        _id: String(s._id),
        name: s.name,
        username: s.username,
        isActive: s.isActive,
        status: s.status,
        exploreInterestsEnabled: s.exploreInterestsEnabled,
        exploreInterestsProductIds: s.exploreInterestsProductIds || [],
        productCount: (s.exploreInterestsProductIds || []).length,
        updatedAt: s.updatedAt,
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
