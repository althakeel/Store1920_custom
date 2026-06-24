import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Address from '@/models/Address';
import { fetchNormalizedDelhiveryTracking } from '@/lib/delhivery';
import AbandonedCart from '@/models/AbandonedCart';
import { attachConversionToOrders } from '@/lib/storeOrderInsights';
import { batchPopulateOrderUsers } from '@/lib/storeOrderUsers';

// Debug log helper
function debugLog(...args) {
    try { console.log('[ORDER API DEBUG]', ...args); } catch {}
}



// Update seller order status
export async function POST(request) {
    try {
        await connectDB();
        
        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const { getAuth } = await import('firebase-admin/auth');
        const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
        if (getApps().length === 0) {
            initializeApp({ credential: applicationDefault() });
        }
        let decodedToken;
        try {
            decodedToken = await getAuth().verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const storeId = await authSeller(userId)
        if(!storeId){
            return NextResponse.json({ error: 'not authorized' }, { status: 401 })
        }

        const {orderId, status } = await request.json()

        await Order.findOneAndUpdate(
            { _id: orderId, storeId },
            { status }
        );

        return NextResponse.json({message: "Order Status updated"})
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 })
    }
}

// Get all orders for a seller
export async function GET(request){
    console.log('[ORDER API ROUTE] Route hit');
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const includeDelhivery = searchParams.get('withDelhivery') === 'true';
        
        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const { getAuth } = await import('firebase-admin/auth');
        const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
        if (getApps().length === 0) {
            initializeApp({ credential: applicationDefault() });
        }
        let decodedToken;
        try {
            decodedToken = await getAuth().verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        debugLog('userId from Firebase:', userId);
        const storeId = await authSeller(userId)
        debugLog('storeId from authSeller:', storeId);
        if(!storeId){
            debugLog('Not authorized: no storeId');
            return NextResponse.json({ error: 'not authorized' }, { status: 401 })
        }

        const [orders, convertedCarts] = await Promise.all([
            Order.find({ storeId })
                .populate('addressId')
                .populate({
                    path: 'orderItems.productId',
                    model: 'Product',
                    select: 'name slug images sku',
                })
                .sort({ createdAt: -1, shortOrderNumber: -1 })
                .lean(),
            AbandonedCart.find({ storeId, status: 'converted' })
                .select('_id userId email phone status convertedAt convertedBy convertedByName convertedCartTotal cartTotal conversionNote conversionDiscountType conversionDiscountValue conversionPaymentMethod linkedOrderId')
                .lean(),
        ]);
        
        debugLog('orders found:', orders.length);
        
        await batchPopulateOrderUsers(orders, { getAuth });
        
        if (orders.length > 0) {
            debugLog('First order after population:', {
                _id: orders[0]._id,
                userId: orders[0].userId,
                userIdType: typeof orders[0].userId,
                shippingAddress: orders[0].shippingAddress,
                isGuest: orders[0].isGuest
            });
        }

        let enrichedOrders = attachConversionToOrders(orders, convertedCarts);

        if (includeDelhivery) {
            const shouldFetchDelhivery = (order) => {
                const trackingId = order.trackingId || order.awb || order.airwayBillNo;
                const courier = (order.courier || '').toLowerCase();
                const isTerminal = ['DELIVERED', 'RETURNED'].includes(order.status);
                return Boolean(trackingId) && (courier.includes('delhivery') || !order.trackingUrl) && !isTerminal;
            };

            const MAX_DELHIVERY_ENRICH = 20;
            let delhiveryEnriched = 0;

            enrichedOrders = await Promise.all(enrichedOrders.map(async (order) => {
                if (!shouldFetchDelhivery(order) || delhiveryEnriched >= MAX_DELHIVERY_ENRICH) return order;
                delhiveryEnriched += 1;
                const trackingId = order.trackingId || order.awb || order.airwayBillNo;
                try {
                    const normalized = await fetchNormalizedDelhiveryTracking(trackingId);
                    if (normalized) {
                        return {
                            ...order,
                            courier: normalized.courier || order.courier,
                            trackingId: normalized.trackingId || order.trackingId,
                            trackingUrl: normalized.trackingUrl || order.trackingUrl,
                            delhivery: normalized.delhivery
                        };
                    }
                } catch (dlErr) {
                    debugLog('Delhivery enrichment failed for order', order._id, dlErr?.message || dlErr);
                }
                return order;
            }));
        }

        return NextResponse.json({orders: enrichedOrders})
    } catch (error) {
        console.error('[ORDER API ERROR]', error);
        debugLog('API error:', error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 })
    }
}