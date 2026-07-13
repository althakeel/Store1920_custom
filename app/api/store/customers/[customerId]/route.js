import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Order from '@/models/Order';
import AbandonedCart from '@/models/AbandonedCart';
import Wallet from '@/models/Wallet';
import { linkGuestOrdersToUser } from '@/lib/linkGuestOrders';
import { normalizeEmail } from '@/lib/orderIdentity';

// Get individual customer details with full order history
export async function GET(request, { params }) {
    try {
        await connectDB();
        
        // Firebase Auth
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const idToken = authHeader.split(" ")[1];
        const { getAuth } = await import('firebase-admin/auth');
        const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
        if (getApps().length === 0) {
            initializeApp({ credential: applicationDefault() });
        }
        let decodedToken;
        try {
            decodedToken = await getAuth().verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const storeId = await authSeller(userId);
        const { customerId } = await params;

        let resolvedCustomerId = customerId;
        let isGuest = customerId.startsWith('guest-') || customerId.startsWith('unknown-');
        
        let customer;
        let orders;

        if (isGuest) {
            const guestEmail = normalizeEmail(customerId.replace(/^(guest-|unknown-)/, ''));
            const registeredUser = guestEmail
                ? await User.findOne({
                    $expr: {
                        $eq: [
                            { $toLower: { $ifNull: ['$email', ''] } },
                            guestEmail,
                        ],
                    },
                }).select('_id name email image').lean()
                : null;

            if (registeredUser) {
                await linkGuestOrdersToUser(registeredUser._id, { email: registeredUser.email }).catch(() => {});
                resolvedCustomerId = registeredUser._id;
                isGuest = false;
            }
        }

        if (isGuest) {
            const guestEmail = customerId.replace(/^(guest-|unknown-)/, '');
            
            // Get orders for this guest
            orders = await Order.find({
                storeId: storeId,
                isGuest: true,
                $or: [
                    { guestEmail: guestEmail },
                    { guestEmail: normalizeEmail(guestEmail) },
                    { 'shippingAddress.email': guestEmail },
                    { 'shippingAddress.email': normalizeEmail(guestEmail) },
                ],
            })
            .populate({
                path: 'orderItems.productId',
                model: 'Product'
            })
            .sort({ createdAt: -1 })
            .lean();

            // Build customer object from guest order data
            if (orders.length > 0) {
                customer = {
                    _id: customerId,
                    name: orders[0].guestName || orders[0].shippingAddress?.name || 'Guest Checkout',
                    email: orders[0].guestEmail || orders[0].shippingAddress?.email || 'No email (Guest)',
                    image: null,
                    isGuest: true
                };
            } else {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }
        } else {
            // Get all orders from this customer for this store first
            orders = await Order.find({
                userId: resolvedCustomerId,
                storeId: storeId
            })
            .populate({
                path: 'orderItems.productId',
                model: 'Product'
            })
            .sort({ createdAt: -1 })
            .lean();

            // Try to get customer information for registered user
            let userDoc = null;
            try {
                userDoc = await User.findById(resolvedCustomerId).select('_id name email image').lean();
            } catch (err) {
                // Invalid ObjectId format
            }

            if (userDoc) {
                customer = userDoc;
            } else if (orders.length > 0) {
                // User not found but has orders - construct customer from order data
                customer = {
                    _id: resolvedCustomerId,
                    name: orders[0].guestName || orders[0].shippingAddress?.name || 'Customer',
                    email: orders[0].guestEmail || orders[0].shippingAddress?.email || 'No email',
                    image: null
                };
            } else {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }
        }

        // Convert orderItems to items format
        const ordersWithItems = orders.map(order => ({
            ...order,
            items: JSON.stringify(order.orderItems.map(item => ({
                name: item.productId?.name || 'Product',
                price: item.price,
                quantity: item.quantity
            })))
        }));

        // Get abandoned cart for this customer (if exists)
        const abandonedCart = isGuest 
            ? await AbandonedCart.findOne({
                guestEmail: customer.email,
                storeId: storeId
            }).lean()
            : await AbandonedCart.findOne({
                userId: resolvedCustomerId,
                storeId: storeId
            }).lean();

        // Calculate statistics
        const totalSpent = ordersWithItems.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = ordersWithItems.length;
        const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

        let walletBalance = 0;
        let walletTransactions = [];
        if (!isGuest) {
            const wallet = await Wallet.findOne({ userId: resolvedCustomerId }).lean();
            walletBalance = Number(wallet?.coins || 0);
            walletTransactions = wallet?.transactions || [];
        }

        const customerDetails = {
            ...customer,
            isGuest,
            totalOrders,
            totalSpent,
            averageOrderValue: Math.round(averageOrderValue),
            firstOrderDate: ordersWithItems.length > 0 ? ordersWithItems[ordersWithItems.length - 1].createdAt : null,
            lastOrderDate: ordersWithItems.length > 0 ? ordersWithItems[0].createdAt : null,
            orders: ordersWithItems,
            abandonedCart,
            walletBalance,
            walletTransactions
        };

        return NextResponse.json({ customer: customerDetails });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}
