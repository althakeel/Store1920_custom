import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Rating from "@/models/Rating";
import AbandonedCart from "@/models/AbandonedCart";
import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/firebase-admin";

// Next.js API route handler for GET
export async function GET(request) {
   try {
      // Firebase Auth: Extract token from Authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
         decodedToken = await getAuth().verifyIdToken(idToken);
      } catch (e) {
         return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      const userId = decodedToken.uid;
      const storeId = await authSeller(userId);
      if (!storeId) {
         return NextResponse.json({ error: 'Forbidden: Seller not approved or no store found.' }, { status: 403 });
      }

      await dbConnect();

      const productIdsPromise = Product.find({ storeId }).select('_id').lean();

      const [orders, totalProducts, abandonedCarts, productIds] = await Promise.all([
        Order.find({ storeId }).select('status total createdAt userId').lean(),
        Product.countDocuments({ storeId }),
        AbandonedCart.countDocuments({
          storeId,
          status: { $ne: 'converted' },
        }),
        productIdsPromise,
      ]);

      const ratings = await Rating.find({
        productId: { $in: productIds.map((product) => product._id.toString()) },
      }).select('rating productId').lean();

      const uniqueCustomerIds = [...new Set(orders.map((order) => order.userId).filter(Boolean))];
      const totalCustomers = uniqueCustomerIds.length;

      const totalEarnings = orders.reduce((acc, order) => acc + (order.total || 0), 0);
      const totalOrders = orders.length;
      const avgOrderValue = totalOrders > 0 ? Math.round(totalEarnings / totalOrders) : 0;

      const days = 30;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const trendMap = {};

      for (let i = days - 1; i >= 0; i -= 1) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        trendMap[key] = { date: key, orders: 0, revenue: 0 };
      }

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);

      let ordersThisWeek = 0;
      let revenueThisWeek = 0;

      orders.forEach((order) => {
        const createdAt = new Date(order.createdAt || 0);
        const dateKey = createdAt.toISOString().split('T')[0];

        if (trendMap[dateKey]) {
          trendMap[dateKey].orders += 1;
          trendMap[dateKey].revenue += order.total || 0;
        }

        if (createdAt >= weekAgo) {
          ordersThisWeek += 1;
          revenueThisWeek += order.total || 0;
        }
      });

      const ordersTrend = Object.values(trendMap).map((entry) => ({
        ...entry,
        revenue: Math.round(entry.revenue),
        label: new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      }));

      const statusLabels = {
        ORDER_PLACED: 'Placed',
        PROCESSING: 'Processing',
        WAITING_FOR_PICKUP: 'Waiting for pickup',
        PICKUP_REQUESTED: 'Pickup requested',
        PICKED_UP: 'Picked up',
        WAREHOUSE_RECEIVED: 'Warehouse received',
        SHIPPED: 'Shipped',
        OUT_FOR_DELIVERY: 'Out for delivery',
        DELIVERED: 'Delivered',
        CANCELLED: 'Cancelled',
        PAYMENT_FAILED: 'Payment failed',
        RETURNED: 'Returned',
        RETURN_INITIATED: 'Return initiated',
        RETURN_APPROVED: 'Return approved',
      };

      const getStatusBucket = (status = '') => {
        const normalized = String(status || '').toUpperCase();

        if (normalized === 'DELIVERED') return 'delivered';
        if (['RETURNED', 'RETURN_INITIATED', 'RETURN_APPROVED'].includes(normalized)) return 'returned';
        if (
          ['SHIPPED', 'OUT_FOR_DELIVERY', 'PICKED_UP', 'PICKUP_REQUESTED', 'WAITING_FOR_PICKUP', 'WAREHOUSE_RECEIVED', 'IN_TRANSIT'].includes(normalized)
        ) {
          return 'shipping';
        }
        if (['CANCELLED', 'PAYMENT_FAILED'].includes(normalized)) return 'cancelled';
        return 'processing';
      };

      const statusTrendMap = {};

      for (let i = days - 1; i >= 0; i -= 1) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        statusTrendMap[key] = {
          date: key,
          label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          total: 0,
          processing: 0,
          shipping: 0,
          delivered: 0,
          returned: 0,
          cancelled: 0,
        };
      }

      const statusTotals = {
        total: totalOrders,
        processing: 0,
        shipping: 0,
        delivered: 0,
        returned: 0,
        cancelled: 0,
      };

      orders.forEach((order) => {
        const bucket = getStatusBucket(order.status);
        statusTotals[bucket] += 1;

        const createdAt = new Date(order.createdAt || 0);
        const dateKey = createdAt.toISOString().split('T')[0];
        if (!statusTrendMap[dateKey]) return;

        statusTrendMap[dateKey][bucket] += 1;
        statusTrendMap[dateKey].total += 1;
      });

      const ordersStatusTrend = Object.values(statusTrendMap);

      const statusCounts = {};
      orders.forEach((order) => {
        const status = order.status || 'UNKNOWN';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const orderStatusBreakdown = Object.entries(statusCounts)
        .map(([status, count]) => ({
          status,
          label: statusLabels[status] || status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
          count,
        }))
        .sort((a, b) => b.count - a.count);

      const ratingBreakdown = [1, 2, 3, 4, 5].map((star) => ({
        star: `${star}★`,
        count: ratings.filter((rating) => Math.round(Number(rating.rating || 0)) === star).length,
      }));

      const avgRating = ratings.length
        ? Number((ratings.reduce((sum, rating) => sum + Number(rating.rating || 0), 0) / ratings.length).toFixed(1))
        : 0;

      const dashboardData = {
         ratings,
         totalOrders,
         totalEarnings: Math.round(totalEarnings),
         totalProducts,
         totalCustomers,
         abandonedCarts,
         analytics: {
           ordersTrend,
           ordersStatusTrend,
           statusTotals,
           orderStatusBreakdown,
           ratingBreakdown,
           avgOrderValue,
           avgRating,
           ordersThisWeek,
           revenueThisWeek: Math.round(revenueThisWeek),
         },
      };

      return NextResponse.json({ dashboardData });
   } catch (error) {
      console.error(error);
      return NextResponse.json({ error: error.code || error.message }, { status: 400 });
   }
}