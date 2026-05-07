import { NextResponse } from 'next/server'
import { calculateRate } from '@/lib/c3xpress'

/**
 * GET /api/c3xpress/rate?origin=DXB&destination=AUH&weight=1&serviceType=NOR
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const origin = searchParams.get('origin')
    const destination = searchParams.get('destination')
    const weight = parseFloat(searchParams.get('weight') || '1')
    const dimension = searchParams.get('dimension') || ''
    const product = searchParams.get('product') || 'XPS'
    const serviceType = searchParams.get('serviceType') || 'NOR'

    if (!origin || !destination) {
      return NextResponse.json({ error: 'origin and destination are required' }, { status: 400 })
    }

    const result = await calculateRate({ origin, destination, weight, dimension, product, serviceType })

    return NextResponse.json({
      success: true,
      freight: result.Freight,
      fuel: result.Fuel,
      netAmount: result.NetAmount,
      tax: result.Tax,
      vat: result.Vat,
    })
  } catch (error) {
    const msg = error?.message || 'Rate calculation failed'
    return NextResponse.json({ error: msg }, { status: msg.includes('not configured') ? 503 : 502 })
  }
}
