import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { mapWaslahSubtagToOrderStatus } from '@/lib/waslahTracking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/waslah
 * Receives Waslah tracking updates (subtag events).
 *
 * Expected body shape (flexible):
 * {
 *   "reference": "ORDER_733862",
 *   "order_id": "69d49504b8b8c324619d4f8c",
 *   "tracking_number": "62007200700011",
 *   "subtag": "Delivered_001",
 *   "subtag_message": "Delivered",
 *   "message": "Delivered"
 * }
 */
export async function POST(request) {
  try {
    const secret = process.env.WASLAH_WEBHOOK_SECRET;
    if (secret) {
      const header = request.headers.get('x-waslah-secret') || request.headers.get('authorization');
      const provided = String(header || '').replace(/^Bearer\s+/i, '').trim();
      if (provided !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    const subtag = body?.subtag || body?.status || '';
    const reference = String(body?.reference || '').trim();
    const waslahOrderId = String(body?.order_id || body?.orderId || '').trim();
    const trackingNumber = String(body?.tracking_number || body?.trackingNumber || '').trim();
    const message = body?.message || body?.subtag_message || '';

    await dbConnect();

    const query = { $or: [] };
    if (waslahOrderId) query.$or.push({ 'waslah.orderId': waslahOrderId });
    if (reference) {
      query.$or.push({ 'waslah.reference': reference });
      query.$or.push({ shortOrderNumber: Number(reference.replace(/\D/g, '')) || -1 });
    }
    if (trackingNumber) query.$or.push({ trackingId: trackingNumber });

    if (!query.$or.length) {
      return NextResponse.json({ ok: false, error: 'No lookup keys in webhook payload' }, { status: 400 });
    }

    const order = await Order.findOne(query.$or.length === 1 ? query.$or[0] : query).lean();
    if (!order) {
      return NextResponse.json({ ok: true, matched: false });
    }

    const nextStatus = mapWaslahSubtagToOrderStatus(subtag);
    const update = {
      'waslah.lastSubtag': subtag || order.waslah?.lastSubtag,
      'waslah.lastSubtagMessage': message || order.waslah?.lastSubtagMessage,
    };
    if (trackingNumber) {
      update.trackingId = trackingNumber;
      update['waslah.trackingNumber'] = trackingNumber;
    }
    if (nextStatus) {
      update.status = nextStatus;
    }

    await Order.findByIdAndUpdate(order._id, { $set: update });

    return NextResponse.json({ ok: true, matched: true, orderId: String(order._id), status: nextStatus });
  } catch (error) {
    console.error('[webhooks/waslah]', error);
    return NextResponse.json({ error: error?.message || 'Webhook failed' }, { status: 500 });
  }
}
