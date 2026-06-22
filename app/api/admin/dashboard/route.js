import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import Store from "@/models/Store";
import Product from "@/models/Product";
import { NextResponse } from "next/server";

export async function GET(request) {
    try {
        await dbConnect();

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const [
            totalOrders,
            totalStores,
            totalProducts,
            revenueAgg,
            uniqueCustomers,
            ordersChartAgg,
        ] = await Promise.all([
            Order.countDocuments(),
            Store.countDocuments(),
            Product.countDocuments(),
            Order.aggregate([
                { $group: { _id: null, revenue: { $sum: { $ifNull: ['$total', 0] } } } },
            ]),
            Order.distinct('userId', { userId: { $exists: true, $nin: [null, ''] } }),
            Order.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                        },
                        orders: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
                {
                    $project: {
                        _id: 0,
                        date: '$_id',
                        orders: 1,
                    },
                },
            ]),
        ]);

        const revenue = Number(revenueAgg[0]?.revenue || 0).toFixed(2);

        const dashboardData = {
            orders: totalOrders,
            stores: totalStores,
            products: totalProducts,
            revenue,
            customers: uniqueCustomers.length,
            ordersChartData: ordersChartAgg,
        };

        return NextResponse.json({ dashboardData });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}
