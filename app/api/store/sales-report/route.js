import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Order from "@/models/Order";
import Product from "@/models/Product";
import MarketingExpense from "@/models/MarketingExpense";
import authSeller from "@/middlewares/authSeller";
import { getAuth } from '@/lib/firebase-admin';
import { buildProductCostMap, calculateOrderProductCost } from '@/lib/storeSalesReport';

function buildDateFilter(dateRange, fromDate, toDate) {
    const now = new Date();

    switch (dateRange) {
        case 'TODAY':
            return {
                createdAt: {
                    $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                    $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
                },
            };
        case 'YESTERDAY':
            return {
                createdAt: {
                    $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
                    $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                },
            };
        case 'THIS_WEEK': {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            return { createdAt: { $gte: startOfWeek } };
        }
        case 'LAST_WEEK': {
            const startOfLastWeek = new Date(now);
            startOfLastWeek.setDate(now.getDate() - now.getDay() - 7);
            startOfLastWeek.setHours(0, 0, 0, 0);
            const endOfLastWeek = new Date(startOfLastWeek);
            endOfLastWeek.setDate(startOfLastWeek.getDate() + 7);
            return {
                createdAt: {
                    $gte: startOfLastWeek,
                    $lt: endOfLastWeek,
                },
            };
        }
        case 'THIS_MONTH':
            return {
                createdAt: {
                    $gte: new Date(now.getFullYear(), now.getMonth(), 1),
                },
            };
        case 'LAST_MONTH':
            return {
                createdAt: {
                    $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                    $lt: new Date(now.getFullYear(), now.getMonth(), 1),
                },
            };
        case 'THIS_YEAR':
            return {
                createdAt: {
                    $gte: new Date(now.getFullYear(), 0, 1),
                },
            };
        case 'LAST_YEAR':
            return {
                createdAt: {
                    $gte: new Date(now.getFullYear() - 1, 0, 1),
                    $lt: new Date(now.getFullYear(), 0, 1),
                },
            };
        case 'CUSTOM':
            if (fromDate && toDate) {
                return {
                    createdAt: {
                        $gte: new Date(fromDate),
                        $lte: new Date(new Date(toDate).setHours(23, 59, 59, 999)),
                    },
                };
            }
            return {};
        default:
            return {
                createdAt: {
                    $gte: new Date(now.getFullYear(), now.getMonth(), 1),
                },
            };
    }
}

export async function GET(req) {
    try {
        await connectDB();

        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decoded = await getAuth().verifyIdToken(token);
        if (!decoded?.uid) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const storeId = await authSeller(decoded.uid);
        if (!storeId) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const dateRange = searchParams.get('dateRange') || 'THIS_MONTH';
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');
        const dateFilter = buildDateFilter(dateRange, fromDate, toDate);

        const [orders, marketingExpenses] = await Promise.all([
            Order.find({
                storeId,
                ...dateFilter,
                status: { $ne: 'CANCELLED' },
            })
                .select('shortOrderNumber createdAt total shippingFee status orderItems')
                .sort({ createdAt: -1 })
                .lean(),
            MarketingExpense.find({ storeId, ...dateFilter }).select('amount').lean(),
        ]);

        const productCostMap = await buildProductCostMap(orders, Product);

        let totalRevenue = 0;
        let totalProductCosts = 0;
        let totalDeliveryCosts = 0;
        const totalMarketingCosts = marketingExpenses.reduce(
            (sum, expense) => sum + Number(expense.amount || 0),
            0
        );

        const ordersWithProfit = orders.map((order) => {
            const orderProductCost = calculateOrderProductCost(order, productCostMap);
            const orderRevenue = Number(order.total || 0);
            const orderDeliveryCost = Number(order.shippingFee || 0);
            const orderProfit = orderRevenue - orderProductCost - orderDeliveryCost;

            totalRevenue += orderRevenue;
            totalProductCosts += orderProductCost;
            totalDeliveryCosts += orderDeliveryCost;

            return {
                _id: order._id,
                shortOrderNumber: order.shortOrderNumber,
                createdAt: order.createdAt,
                total: orderRevenue,
                productCost: orderProductCost,
                shippingFee: orderDeliveryCost,
                profit: orderProfit,
                status: order.status,
            };
        });

        const totalCosts = totalProductCosts + totalDeliveryCosts + totalMarketingCosts;
        const totalProfit = totalRevenue - totalCosts;
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
        const avgProfit = orders.length > 0 ? totalProfit / orders.length : 0;

        const monthsMap = new Map();

        ordersWithProfit.forEach((order) => {
            const monthYear = new Date(order.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
            });

            if (!monthsMap.has(monthYear)) {
                monthsMap.set(monthYear, {
                    month: monthYear,
                    orders: 0,
                    revenue: 0,
                    costs: 0,
                    profit: 0,
                });
            }

            const monthData = monthsMap.get(monthYear);
            monthData.orders += 1;
            monthData.revenue += order.total;
            monthData.costs += order.productCost + order.shippingFee;
            monthData.profit += order.profit;
        });

        const report = {
            totalRevenue,
            totalCosts,
            productCosts: totalProductCosts,
            deliveryCosts: totalDeliveryCosts,
            marketingCosts: totalMarketingCosts,
            totalProfit,
            profitMargin,
            totalOrders: orders.length,
            avgOrderValue,
            avgProfit,
            monthlyData: Array.from(monthsMap.values()),
        };

        return NextResponse.json({
            success: true,
            report,
            orders: ordersWithProfit,
        });
    } catch (error) {
        console.error('Sales report error:', error);
        return NextResponse.json(
            { error: 'Failed to generate sales report' },
            { status: 500 }
        );
    }
}
