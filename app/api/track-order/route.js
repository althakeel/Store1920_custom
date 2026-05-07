import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Order from '@/models/Order'
import { fetchNormalizedDelhiveryTracking } from '@/lib/delhivery'
import { fetchNormalizedC3XTracking, trackByReference, normalizeC3XShipment } from '@/lib/c3xpress'

const asOrderShape = (normalized, awb = '') => {
  if (!normalized) return null;
  return {
    courier: normalized.courier,
    trackingId: normalized.trackingId || awb,
    trackingUrl: normalized.trackingUrl,
    delhivery: normalized.delhivery,
    orderItems: [],
    total: 0
  };
};

export async function GET(req) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')
    const awbParam = searchParams.get('awb')
    const orderIdParam = searchParams.get('orderId')
    // Support either ?awb= or ?orderId= for the same input value
    const awb = awbParam || orderIdParam
    const carrier = (searchParams.get('carrier') || '').toLowerCase()

    if (!phone && !awb) {
      return NextResponse.json(
        { success: false, message: 'Phone Number or AWB Number is required' },
        { status: 400 }
      )
    }

    // If explicitly requested, try Delhivery directly first
    if (carrier === 'delhivery' && awb) {
      try {
        const normalized = await fetchNormalizedDelhiveryTracking(awb.trim())
        const synthetic = asOrderShape(normalized, awb.trim())
        if (synthetic) {
          return NextResponse.json({ success: true, order: synthetic })
        }
      } catch (e) {
        const msg = (e?.message || '').includes('DELHIVERY_API_TOKEN')
          ? 'Tracking temporarily unavailable. Delhivery API token not configured.'
          : `Delhivery tracking failed: ${e?.message || 'Unknown error'}`
        return NextResponse.json({ success: false, message: msg }, { status: 503 })
      }
    }

    // If explicitly requested, try C3Xpress directly
    if (carrier === 'c3xpress' && awb) {
      try {
        const normalized = await fetchNormalizedC3XTracking(awb.trim())
        if (!normalized) {
          // fallback: try by shipper reference
          const raw = await trackByReference(awb.trim()).catch(() => null)
          const byRef = raw ? normalizeC3XShipment(raw, awb.trim()) : null
          if (byRef) return NextResponse.json({ success: true, order: asOrderShape(byRef, awb.trim()) })
          return NextResponse.json({ success: false, message: 'Shipment not found on C3Xpress' }, { status: 404 })
        }
        return NextResponse.json({ success: true, order: asOrderShape(normalized, awb.trim()) })
      } catch (e) {
        const msg = (e?.message || '').includes('not configured')
          ? 'C3Xpress not configured.'
          : `C3Xpress tracking failed: ${e?.message || 'Unknown error'}`
        return NextResponse.json({ success: false, message: msg }, { status: 503 })
      }
    }

    let order = null;
    if (awb) {
      const awbTrim = awb.trim();
      // 1. Try by trackingId
      order = await Order.findOne({ trackingId: awbTrim }).lean()
        .populate('orderItems.productId')
        .sort({ createdAt: -1 })
        .lean();
      // 2. Try by full orderId (ObjectId)
      if (!order && /^[a-fA-F0-9]{24}$/.test(awbTrim)) {
        order = await Order.findOne({ _id: awbTrim }).lean()
          .populate('orderItems.productId')
          .lean();
      }
      // 3. Try by shortOrderNumber field
      if (!order && /^\d{1,}$/.test(awbTrim)) {
        order = await Order.findOne({ shortOrderNumber: Number(awbTrim) }).lean()
          .populate('orderItems.productId')
          .lean();
      }
    }
    // 4. Try by phone number if provided (fallback)
    if (!order && phone) {
      order = await Order.findOne({ 'shippingAddress.phone': phone.trim() }).lean()
        .populate('orderItems.productId')
        .sort({ createdAt: -1 })
        .lean();
    }
    if (!order) {
      // Fallback: try to fetch directly from Delhivery using provided AWB
      if (awb) {
        try {
          const normalized = await fetchNormalizedDelhiveryTracking(awb.trim());
          const synthetic = asOrderShape(normalized, awb.trim());
          if (synthetic) {
            return NextResponse.json({ success: true, order: synthetic });
          }
        } catch (e) {
          console.error('Delhivery fallback failed:', e?.message || e);
        }
      }
      return NextResponse.json(
        { success: false, message: 'Order not found with the provided information' },
        { status: 404 }
      );
    }
    
    // Ensure shortOrderNumber exists (for old orders without it)
    if (!order.shortOrderNumber && order._id) {
      const hex = order._id.toString().slice(-6);
      order.shortOrderNumber = parseInt(hex, 16);
    }
    
    // If order has a Delhivery trackingId, fetch live tracking
    try {
      const courier = (order.courier || '').toLowerCase()
      const trackingId = order.trackingId || order.awb || order.airwayBillNo

      if (trackingId && courier.includes('c3xpress')) {
        // C3Xpress live tracking
        const normalized = await fetchNormalizedC3XTracking(trackingId).catch(() => null)
        if (normalized) {
          order.c3x = normalized.c3x
          order.trackingUrl = order.trackingUrl || normalized.trackingUrl
          order.courier = order.courier || normalized.courier
          order.trackingId = order.trackingId || normalized.trackingId
          if (normalized.c3x?.appStatus) {
            order.status = normalized.c3x.appStatus
          }
        }
      } else if (trackingId && (courier.includes('delhivery') || !order.trackingUrl)) {
        const normalized = await fetchNormalizedDelhiveryTracking(trackingId)
        if (normalized) {
          order.delhivery = normalized.delhivery
          order.trackingUrl = order.trackingUrl || normalized.trackingUrl
          order.courier = order.courier || normalized.courier
          order.trackingId = order.trackingId || normalized.trackingId
          
          // IMPORTANT: Update order.status to match delhivery tracking status if available
          if (normalized.delhivery?.current_status) {
            order.status = normalized.delhivery.current_status
          }
        }
      }
    } catch (e) {
      // Don't fail the API if courier call fails; just log
      console.error('Live tracking fetch failed:', e?.message || e)
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('Track order error:', error && error.stack ? error.stack : error)
    return NextResponse.json(
      { success: false, message: 'Failed to track order', error: error?.message || error },
      { status: 500 }
    )
  }
}
