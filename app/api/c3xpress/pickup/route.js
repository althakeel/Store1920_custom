import { NextResponse } from 'next/server'
import { scheduleC3XPickup, trackPickup } from '@/lib/c3xpress'
import { getAuth } from '@/lib/firebase-admin'
import authSeller from '@/middlewares/authSeller'

async function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const decoded = await getAuth().verifyIdToken(authHeader.split(' ')[1])
    return decoded.uid || null
  } catch { return null }
}

/**
 * POST /api/c3xpress/pickup   — schedule a pickup
 * Body: { bookingData: BookingData }
 */
export async function POST(request) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await authSeller(userId)

    const { bookingData } = await request.json()
    if (!bookingData) {
      return NextResponse.json({ error: 'bookingData is required' }, { status: 400 })
    }

    const result = await scheduleC3XPickup(bookingData)
    return NextResponse.json({ success: true, pickupRequestNo: result.PickupRequestNo })
  } catch (error) {
    const msg = error?.message || 'Pickup scheduling failed'
    return NextResponse.json({ error: msg }, { status: msg.includes('not configured') ? 503 : 500 })
  }
}

/**
 * GET /api/c3xpress/pickup?bookingNo=C12
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const bookingNo = searchParams.get('bookingNo')
    if (!bookingNo) {
      return NextResponse.json({ error: 'bookingNo is required' }, { status: 400 })
    }

    const result = await trackPickup(bookingNo.trim())
    const booking = result?.BookingTrackList?.[0] || null
    return NextResponse.json({ success: true, booking })
  } catch (error) {
    const msg = error?.message || 'Pickup tracking failed'
    return NextResponse.json({ error: msg }, { status: msg.includes('not configured') ? 503 : 502 })
  }
}
