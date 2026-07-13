import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { isWaslahLabelReadyOrder } from '@/lib/waslahReceipts';

export const dynamic = 'force-dynamic';

/**
 * POST /api/store/waslah/mark-label-printed
 * Body: { orderIds: string[] }
 */
export async function POST(request) {
  try {
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

    const printableIds = orders
      .filter(isWaslahLabelReadyOrder)
      .map((order) => order._id);

    if (!printableIds.length) {
      return Response.json(
        { error: 'None of the selected orders have a label ready to mark as printed' },
        { status: 400 },
      );
    }

    const printedAt = new Date();
    await Order.updateMany(
      { _id: { $in: printableIds } },
      { $set: { 'waslah.labelPrintedAt': printedAt } },
    );

    return Response.json({
      success: true,
      markedCount: printableIds.length,
      labelPrintedAt: printedAt.toISOString(),
      orderIds: printableIds.map(String),
    });
  } catch (error) {
    console.error('[store/waslah/mark-label-printed]', error);
    return Response.json(
      { error: error?.message || 'Failed to mark labels as printed' },
      { status: 500 },
    );
  }
}
