import connectDB from '@/lib/mongodb';
import authSeller from '@/middlewares/authSeller';
import Order from '@/models/Order';

export async function POST(request) {
    try {
        await connectDB();

        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
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
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const userId = decodedToken.uid;
        const sellerId = await authSeller(userId);
        if (!sellerId) {
            return new Response(JSON.stringify({ error: 'not authorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { orderId } = await request.json();

        if (!orderId) {
            return new Response(JSON.stringify({ error: 'Order ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Fetch the order
        const order = await Order.findOne({ _id: orderId, storeId: sellerId }).lean();

        if (!order) {
            return new Response(JSON.stringify({ error: 'Order not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate order has required shipping details
        if (!order.shippingAddress || !order.shippingAddress.street || !order.shippingAddress.city) {
            return new Response(JSON.stringify({
                error: 'Incomplete shipping address',
                details: 'Order must have complete shipping address to send to Delhivery'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if order is already sent to Delhivery
        if (order.sentToDelhivery) {
            return new Response(JSON.stringify({
                error: 'Order already sent to Delhivery',
                trackingId: order.trackingId,
                status: 'PENDING_ASSIGNMENT'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Prepare order data for Delhivery
        const orderData = {
            name: order.shippingAddress.name || 'Customer',
            phone: order.shippingAddress.phone || '',
            email: order.shippingAddress.email || '',
            address: order.shippingAddress.street || '',
            city: order.shippingAddress.city || '',
            state: order.shippingAddress.state || '',
            pincode: order.shippingAddress.pincode || order.shippingAddress.zip || '',
            country: order.shippingAddress.country || 'United Arab Emirates',
            order_id: order.shortOrderNumber?.toString() || order._id.toString(),
            weight: order.shipmentWeight || 0.5,
            quantity: order.orderItems?.length || 1,
            cod: order.paymentMethod === 'COD' ? order.total || 0 : 0,
            payment_mode: order.paymentMethod === 'COD' ? 'COD' : 'PAID'
        };

        // Mark order as sent to Delhivery
        await Order.updateOne(
            { _id: orderId, storeId: sellerId },
            {
                $set: {
                    sentToDelhivery: true,
                    sentToDelhiveryAt: new Date(),
                    orderStatus: 'PENDING_ASSIGNMENT',
                    statusTimeline: [
                        {
                            status: 'ORDER_PLACED',
                            timestamp: order.createdAt || new Date(),
                            description: 'Order received'
                        },
                        {
                            status: 'PENDING_ASSIGNMENT',
                            timestamp: new Date(),
                            description: 'Sent to courier - waiting for AWB assignment'
                        }
                    ]
                }
            }
        );

        // TODO: Integrate with actual Delhivery API to send order
        // For now, we're just marking it as sent and updating status

        return new Response(JSON.stringify({
            success: true,
            message: 'Order sent to Delhivery successfully. Waiting for AWB assignment.',
            orderStatus: 'PENDING_ASSIGNMENT',
            orderData
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Send to Delhivery error:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
