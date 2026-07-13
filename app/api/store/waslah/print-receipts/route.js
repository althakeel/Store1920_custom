import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { printWaslahReceipt, isWaslahConfigured } from '@/lib/waslah';
import {
  extractWaslahPrintReceiptUrl,
  getWaslahOrderIdsFromOrders,
  isWaslahLabelReadyOrder,
} from '@/lib/waslahReceipts';

export const dynamic = 'force-dynamic';

/**
 * POST /api/store/waslah/print-receipts
 * Body: { orderIds: string[] }
 *
 * Generates one combined PDF of Waslah order receipts / labels for label-ready orders.
 */
export async function POST(request) {
  try {
    if (!isWaslahConfigured()) {
      return Response.json(
        { error: 'Waslah is not configured. Set WASLAH_API_TOKEN in .env' },
        { status: 503 },
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const orderIds = (Array.isArray(body?.orderIds) ? body.orderIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean);

    if (!orderIds.length) {
      return Response.json({ error: 'orderIds is required' }, { status: 400 });
    }

    await dbConnect();

    const orders = await Order.find({
      _id: { $in: orderIds },
      storeId: String(storeId),
    }).lean();

    if (!orders.length) {
      return Response.json({ error: 'No matching orders found' }, { status: 404 });
    }

    const labelReadyOrders = orders.filter(isWaslahLabelReadyOrder);
    const waslahOrderIds = getWaslahOrderIdsFromOrders(labelReadyOrders);

    if (!waslahOrderIds.length) {
      return Response.json(
        { error: 'None of the selected orders have a Waslah shipment with AWB generated yet' },
        { status: 400 },
      );
    }

    const printResult = await printWaslahReceipt(waslahOrderIds, { withLabel: true });
    const pdfUrl = extractWaslahPrintReceiptUrl(printResult);

    if (!pdfUrl) {
      return Response.json(
        { error: 'Waslah did not return a receipt PDF URL', detail: printResult },
        { status: 502 },
      );
    }

    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      return Response.json(
        { error: `Failed to download receipt PDF from Waslah (HTTP ${pdfResponse.status})` },
        { status: 502 },
      );
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const filename = `order-receipts-${labelReadyOrders.length}-${new Date().toISOString().slice(0, 10)}.pdf`;
    const printedAt = new Date();

    await Order.updateMany(
      { _id: { $in: labelReadyOrders.map((order) => order._id) } },
      { $set: { 'waslah.labelPrintedAt': printedAt } },
    );

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[store/waslah/print-receipts]', error);
    return Response.json(
      { error: error?.message || 'Failed to generate receipt PDF' },
      { status: 500 },
    );
  }
}
