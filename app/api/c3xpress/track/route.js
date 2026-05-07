import { NextResponse } from 'next/server'
import { fetchNormalizedC3XTracking, trackByReference, normalizeC3XShipment } from '@/lib/c3xpress'

/**
 * GET /api/c3xpress/track?awb=XXX
 * GET /api/c3xpress/track?reference=XXX
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const awb = searchParams.get('awb')
    const reference = searchParams.get('reference')

    if (!awb && !reference) {
      return NextResponse.json({ error: 'Provide awb or reference query param' }, { status: 400 })
    }

    let normalized
    if (awb) {
      normalized = await fetchNormalizedC3XTracking(awb.trim())
    } else {
      const raw = await trackByReference(reference.trim())
      normalized = normalizeC3XShipment(raw, reference.trim())
    }

    if (!normalized) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, shipment: normalized })
  } catch (error) {
    const msg = error?.message || 'Tracking failed'
    const status = msg.includes('not configured') ? 503 : 502
    return NextResponse.json({ error: msg }, { status })
  }
}
