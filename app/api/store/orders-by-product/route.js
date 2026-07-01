import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Category from '@/models/Category';
import { getAuth } from '@/lib/firebase-admin';
import { resolveDashboardAccess } from '@/lib/storeAccessControl';
import { canAccessDashboardArea } from '@/lib/storeDashboardPermissions';
import { ACTIVE_RECORD_FILTER } from '@/lib/storeTrash';
import { buildCategoryLookupForProductRefs } from '@/lib/categoryLookup';
import { isFailedSalesReportOrder } from '@/lib/storeSalesReport';
import {
  aggregateOrdersByProduct,
  buildFailedOrderRows,
  buildOrdersByProductDateFilter,
  enrichOrdersByProductRows,
  getOrdersByProductDateLabel,
} from '@/lib/storeOrdersByProduct';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(authHeader.replace('Bearer ', ''));
    if (!decoded?.uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const access = await resolveDashboardAccess(decoded.uid, decoded);
    if (!access.isSeller || !access.storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    if (!canAccessDashboardArea(access.permissions, 'ordersByProduct', { isOwner: access.isOwner })) {
      return NextResponse.json({ error: 'You do not have access to Orders by Product' }, { status: 403 });
    }

    const storeId = access.storeId;

    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || 'TODAY';
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';
    const fromTime = searchParams.get('fromTime') || '';
    const toTime = searchParams.get('toTime') || '';
    const view = searchParams.get('view') === 'failed' ? 'failed' : 'products';
    const dateFilter = buildOrdersByProductDateFilter(dateRange, fromDate, toDate, fromTime, toTime);

    await connectDB();

    const orders = await Order.find({
      storeId,
      ...dateFilter,
      ...ACTIVE_RECORD_FILTER,
      status: { $ne: 'CANCELLED' },
    })
      .select('shortOrderNumber createdAt total status orderItems paymentMethod paymentStatus isPaid delhivery guestName guestEmail guestPhone shippingAddress')
      .lean();

    const failedOrders = orders.filter((order) => isFailedSalesReportOrder(order));
    const successOrders = orders.filter((order) => !isFailedSalesReportOrder(order));

    if (view === 'failed') {
      const failedRows = buildFailedOrderRows(failedOrders);

      return NextResponse.json({
        view,
        dateRange,
        dateLabel: getOrdersByProductDateLabel(dateRange, fromDate, toDate, fromTime, toTime),
        totalOrders: successOrders.length,
        failedOrders: failedOrders.length,
        totalOrdersInRange: orders.length,
        totalProducts: 0,
        rows: failedRows,
      });
    }

    const aggregated = aggregateOrdersByProduct(successOrders);
    const productIds = aggregated.map((row) => row.productId).filter(Boolean);

    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds }, storeId })
        .select('name sku brand category categories slug images inStock')
        .lean()
      : [];

    const categoryMap = await buildCategoryLookupForProductRefs(Category, products);

    const rows = enrichOrdersByProductRows(aggregated, products, categoryMap);

    return NextResponse.json({
      view: 'products',
      dateRange,
      dateLabel: getOrdersByProductDateLabel(dateRange, fromDate, toDate, fromTime, toTime),
      totalOrders: successOrders.length,
      failedOrders: failedOrders.length,
      totalOrdersInRange: orders.length,
      totalProducts: rows.length,
      rows,
    });
  } catch (error) {
    console.error('[orders-by-product] GET error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load orders by product' },
      { status: 500 },
    );
  }
}
