import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Order from '@/models/Order'
import { fetchNormalizedC3XTracking, trackByReference, normalizeC3XShipment, trackPickup } from '@/lib/c3xpress'
import { buildGuestOrderIdentityClauses, normalizeEmail } from '@/lib/orderIdentity'

const asOrderShape = (normalized, awb = '') => {
  if (!normalized) return null;
  return {
    courier: normalized.courier,
    trackingId: normalized.trackingId || awb,
    trackingUrl: normalized.trackingUrl,
    c3x: normalized.c3x,
    status: normalized.c3x?.appStatus || 'SHIPPED',
    orderItems: [],
    total: 0
  };
};

const normalizeC3XPickup = (data, bookingNo = '') => {
  if (!data) return null;
  const bookingEntry = Array.isArray(data.BookingTrackList) && data.BookingTrackList[0]
    ? data.BookingTrackList[0]
    : null;
  const pickupNo =
    data.PickupRequestNo ||
    data.BookingNo ||
    data.PickupNo ||
    bookingEntry?.PickupRequestNo ||
    bookingEntry?.BookingNo ||
    bookingEntry?.PickupNo ||
    bookingNo;
  if (!pickupNo) return null;

  const rawEvents = [
    data.PickupTrackingDetails,
    data.PickupTrackList,
    data.BookingTrackList,
    data.TrackingLogDetails,
    data.Events,
  ].find(Array.isArray) || [];

  const events = rawEvents.map((entry) => ({
    time: [entry.ActivityDate || entry.Date || entry.CreatedDate || entry.BookingDate, entry.ActivityTime || entry.Time]
      .filter(Boolean)
      .join(' ')
      .trim(),
    status: entry.Status || entry.Activity || entry.Event || entry.BookingStatus || 'Pickup update',
    location: entry.Location || entry.City || entry.Origin || '',
    remarks: entry.Remarks || entry.Description || entry.Message || entry.Remark || '',
  }));

  return {
    courier: 'C3Xpress',
    trackingId: String(pickupNo),
    trackingUrl: `https://c3xpress.com/tracking?awb=${encodeURIComponent(String(pickupNo))}`,
    c3x: {
      bookingNo: String(pickupNo),
      appStatus: events.length ? 'PICKUP_REQUESTED' : 'ORDER_PLACED',
      events,
      pickup: data,
    },
  };
};

const lookupC3XByIdentifier = async (identifier) => {
  const value = String(identifier || '').trim();
  if (!value) return null;

  const byAwb = await fetchNormalizedC3XTracking(value).catch(() => null);
  if (byAwb) return byAwb;

  const referenceRaw = await trackByReference(value).catch(() => null);
  const byReference = referenceRaw ? normalizeC3XShipment(referenceRaw, value) : null;
  if (byReference) return byReference;

  const pickupRaw = await trackPickup(value).catch(() => null);
  return pickupRaw ? normalizeC3XPickup(pickupRaw, value) : null;
};

export async function GET(req) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')
    const email = normalizeEmail(searchParams.get('email'))
    const awbParam = searchParams.get('awb')
    const orderIdParam = searchParams.get('orderId')
    // Support either ?awb= or ?orderId= for the same input value
    const awb = awbParam || orderIdParam
    const carrier = (searchParams.get('carrier') || '').toLowerCase()

    if (!phone && !email && !awb) {
      return NextResponse.json(
        { success: false, message: 'Mobile number, email, AWB, reference number, or booking number is required' },
        { status: 400 }
      )
    }

    // If explicitly requested, try C3Xpress directly by AWB, reference, or booking number.
    if (carrier === 'c3xpress' && awb) {
      try {
        const normalized = await lookupC3XByIdentifier(awb.trim())
        if (!normalized) return NextResponse.json({ success: false, message: 'Shipment not found on C3Xpress' }, { status: 404 })
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
    // 4. Try by mobile number or email if provided (fallback)
    if (!order && (phone || email)) {
      const contactClauses = buildGuestOrderIdentityClauses({ email, phone })
      order = contactClauses.length
        ? await Order.findOne({ $or: contactClauses }).lean()
        .populate('orderItems.productId')
        .sort({ createdAt: -1 })
        .lean()
        : null;
    }
    if (!order) {
      // Fallback: try to fetch directly from C3Xpress using AWB, reference, or booking number.
      if (awb) {
        try {
          const normalized = await lookupC3XByIdentifier(awb.trim());
          const synthetic = asOrderShape(normalized, awb.trim());
          if (synthetic) {
            return NextResponse.json({ success: true, order: synthetic });
          }
        } catch (e) {
          console.error('C3Xpress fallback failed:', e?.message || e);
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
    
    // Fetch live C3Xpress tracking when the order has a C3X tracking ID
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
