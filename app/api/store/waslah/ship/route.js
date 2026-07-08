import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { getDisplayOrderNumber } from '@/lib/orderDisplay';
import {
  createWaslahOrder,
  addOrdersToWaslahCart,
  waslahPickupCheckout,
  printWaslahReceipt,
  isWaslahConfigured,
  getWaslahPublicConfig,
} from '@/lib/waslah';
import { buildWaslahOrderPayload, buildDefaultPickupInfo } from '@/lib/waslahOrderMapper';

export const dynamic = 'force-dynamic';

/**
 * POST /api/store/waslah/ship
 * Body: { orderId, pickupInfo?, skipPickup?, paymentMethod? }
 *
 * Full flow:
 * 1. Create Waslah order (if not already created)
 * 2. Add to pickup cart
 * 3. Pickup checkout
 * 4. Print label PDF
 * 5. Save tracking + label on Store1920 order
 */
export async function POST(request) {
  try {
    if (!isWaslahConfigured()) {
      return NextResponse.json(
        { error: 'Waslah is not configured. Set WASLAH_API_TOKEN and WASLAH_API_BASE_URL in .env' },
        { status: 503 },
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const orderId = String(body?.orderId || '').trim();
    const dryRun = Boolean(body?.dryRun);
    const testCreateOnly = Boolean(body?.testCreateOnly);

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    await dbConnect();
    const order = await Order.findOne({ _id: orderId, storeId: String(storeId) }).lean();
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const waslahReference = order.waslah?.reference || getDisplayOrderNumber(order);
    const payload = buildWaslahOrderPayload(order, { reference: waslahReference });

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        createOrderUrl: `${process.env.WASLAH_API_BASE_URL || 'http://localhost:9090/api/v1'}${process.env.WASLAH_CREATE_ORDER_PATH || '/orders'}`,
        payload,
        message: 'Preview only — no Waslah API calls were made.',
      });
    }

    let waslahOrderId = order.waslah?.orderId || null;

    if (!waslahOrderId) {
      const created = await createWaslahOrder(payload);
      waslahOrderId = created?._id || created?.id || created?.data?._id;
      if (!waslahOrderId) {
        return NextResponse.json({ error: 'Waslah did not return an order id', detail: created }, { status: 502 });
      }
    }

    if (testCreateOnly) {
      const preview = await Order.findByIdAndUpdate(
        orderId,
        {
          $set: {
            waslah: {
              ...(order.waslah || {}),
              orderId: waslahOrderId,
              reference: payload.reference,
            },
          },
        },
        { new: true },
      ).lean();

      return NextResponse.json({
        success: true,
        testCreateOnly: true,
        waslahOrderId,
        message: 'Waslah order created (cart/pickup/label skipped). Use full ship for pickup + label.',
        order: preview,
      });
    }

    let cartId = order.waslah?.cartId || null;
    let cartResult = null;
    let checkoutResult = null;

    if (!body?.skipPickup) {
      const pickupInfo = buildDefaultPickupInfo(body?.pickupInfo || {});
      cartResult = await addOrdersToWaslahCart({
        orderIds: [waslahOrderId],
        pickupInfo,
      });
      cartId = cartResult?._id || cartResult?.cart_id || cartId;

      if (cartId) {
        checkoutResult = await waslahPickupCheckout(
          cartId,
          body?.paymentMethod || 'credit_limit',
        );
      }
    }

    const printResult = await printWaslahReceipt([waslahOrderId], { withLabel: true });
    const labelUrl = printResult?.url || null;

    const lineItem = cartResult?.line_items?.find((li) => String(li.order_id) === String(waslahOrderId))
      || cartResult?.line_items?.[0];
    const trackingNumber = lineItem?.tracking_number || order.trackingId || null;
    const courierName = lineItem?.service?.courier?.display_name
      || lineItem?.service?.courier?.name
      || 'EMX';

    const update = {
      trackingId: trackingNumber || order.trackingId,
      courier: courierName,
      status: order.status === 'ORDER_PLACED' || order.status === 'PROCESSING' ? 'SHIPPED' : order.status,
      waslah: {
        orderId: waslahOrderId,
        cartId: cartId || order.waslah?.cartId || null,
        reference: payload.reference,
        trackingNumber: trackingNumber || order.waslah?.trackingNumber || null,
        labelUrl: labelUrl || order.waslah?.labelUrl || null,
        lastSubtag: order.waslah?.lastSubtag || null,
        lastSubtagMessage: order.waslah?.lastSubtagMessage || null,
      },
    };

    const updated = await Order.findByIdAndUpdate(orderId, { $set: update }, { new: true }).lean();

    return NextResponse.json({
      success: true,
      waslahOrderId,
      cartId,
      trackingNumber,
      labelUrl,
      courier: courierName,
      checkout: checkoutResult,
      createOrderUrl: getWaslahPublicConfig().createOrderUrl,
      order: updated,
    });
  } catch (error) {
    console.error('[store/waslah/ship]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create Waslah shipment' },
      { status: 500 },
    );
  }
}
