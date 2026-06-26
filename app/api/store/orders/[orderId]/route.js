import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import { appendOrderCommunicationLog } from '@/lib/orderCommunicationLog';

// Update order status and tracking details
export async function PUT(request, { params }) {
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
        const sellerName = decodedToken.name || decodedToken.email || 'Store staff';
        const storeId = await authSeller(userId);
        const { orderId } = await params;

        // Read update payload
        const body = await request.json();
        const {
            status,
            trackingId,
            trackingUrl,
            courier,
            shippingAddress,
            guestName,
            guestEmail,
            guestPhone,
            paymentMethod,
            paymentStatus,
            isPaid,
            shippingFee,
            total,
            orderItems,
            notes,
            paymentReferenceId,
            tabbyPaymentId,
            tamaraOrderId,
        } = body;

        // Verify the order belongs to this store
        const existingOrder = await Order.findOne({
            _id: orderId,
            storeId: storeId
        })
        .populate({
            path: 'userId',
            select: 'email name'
        })
        .populate({
            path: 'orderItems.productId',
            model: 'Product'
        })
        .lean();

        if (!existingOrder) {
            return NextResponse.json({ error: 'Order not found or unauthorized' }, { status: 404 });
        }

        // Prepare update data
        const updateData = {};
        if (status !== undefined) updateData.status = status;
        if (trackingId !== undefined) updateData.trackingId = trackingId;
        if (trackingUrl !== undefined) updateData.trackingUrl = trackingUrl;
        if (courier !== undefined) updateData.courier = courier;

        if (shippingAddress !== undefined && typeof shippingAddress === 'object') {
            updateData.shippingAddress = {
                ...(existingOrder.shippingAddress || {}),
                ...shippingAddress,
            };
        }
        if (guestName !== undefined) updateData.guestName = String(guestName || '').trim();
        if (guestEmail !== undefined) updateData.guestEmail = String(guestEmail || '').trim().toLowerCase();
        if (guestPhone !== undefined) updateData.guestPhone = String(guestPhone || '').trim();
        if (paymentMethod !== undefined) updateData.paymentMethod = String(paymentMethod || '').toUpperCase();
        if (paymentStatus !== undefined) updateData.paymentStatus = String(paymentStatus || '').toUpperCase();
        if (isPaid !== undefined) updateData.isPaid = Boolean(isPaid);
        if (shippingFee !== undefined) updateData.shippingFee = Number(shippingFee) || 0;
        if (total !== undefined) updateData.total = Number(total) || 0;
        if (notes !== undefined) updateData.notes = String(notes || '').slice(0, 5000);
        if (Array.isArray(orderItems)) {
            updateData.orderItems = orderItems.map((item) => ({
                productId: item?.productId || undefined,
                name: String(item?.name || '').trim(),
                price: Number(item?.price) || 0,
                quantity: Math.max(1, Number(item?.quantity) || 1),
            })).filter((item) => item.name && item.quantity > 0);
        }

        const referenceId = String(paymentReferenceId || tabbyPaymentId || tamaraOrderId || '').trim();
        if (referenceId) {
            updateData.paymentReferenceId = referenceId;
            const method = String(paymentMethod || existingOrder.paymentMethod || '').toUpperCase();
            if (method === 'TABBY' || tabbyPaymentId) updateData.tabbyPaymentId = referenceId;
            if (method === 'TAMARA' || tamaraOrderId) updateData.tamaraOrderId = referenceId;
        }

        const detailsChanged = [
            shippingAddress !== undefined,
            guestName !== undefined,
            guestEmail !== undefined,
            guestPhone !== undefined,
            paymentMethod !== undefined,
            paymentStatus !== undefined,
            isPaid !== undefined,
            shippingFee !== undefined,
            total !== undefined,
            notes !== undefined,
            Array.isArray(orderItems),
            Boolean(referenceId),
        ].some(Boolean);

        const previousStatus = String(existingOrder.status || '').toUpperCase();
        const nextStatus = status !== undefined
            ? String(status || '').toUpperCase()
            : previousStatus;
        const previousTracking = String(existingOrder.trackingId || '').trim();
        const nextTracking = trackingId !== undefined
            ? String(trackingId || '').trim()
            : previousTracking;
        const statusChanged = status !== undefined && nextStatus !== previousStatus;
        const trackingChanged = trackingId !== undefined && nextTracking !== previousTracking;
        const courierChanged = courier !== undefined
            && String(courier || '').trim() !== String(existingOrder.courier || '').trim();
        const trackingUrlChanged = trackingUrl !== undefined
            && String(trackingUrl || '').trim() !== String(existingOrder.trackingUrl || '').trim();
        const shouldNotify = statusChanged || trackingChanged || courierChanged || trackingUrlChanged;

        // Update the order
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            updateData,
            { new: true }
        )
        .populate({
            path: 'orderItems.productId',
            model: 'Product',
            select: 'name slug images sku',
        })
        .lean();

        if (detailsChanged) {
            await appendOrderCommunicationLog(orderId, {
                channel: 'system',
                template: 'order_details_edited',
                label: 'Order details updated',
                status: 'sent',
                recipient: existingOrder.guestEmail || existingOrder.shippingAddress?.email || '',
                sentByUid: userId,
                sentByName: sellerName,
                details: 'Address, items, payment, or totals edited from store dashboard',
            });
        }

        // Decide what status value to send to the email service:
        // - If the request explicitly changed status, use the updated status.
        // - If only tracking was added (no status field in body), send
        //   "no status" so the notification route can treat this as a
        //   pure tracking/AWB update email.
        const statusForEmail = statusChanged ? updatedOrder.status : null;

        // Send email notification only when something actually changed
        if (shouldNotify) {
            try {
                // Call email notification API
                await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/order-status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        orderId: updatedOrder._id.toString(),
                        shortOrderNumber: existingOrder.shortOrderNumber,
                        email: existingOrder.userId?.email
                          || existingOrder.guestEmail
                          || existingOrder.shippingAddress?.email,
                        customerName: existingOrder.userId?.name
                          || existingOrder.guestName
                          || existingOrder.shippingAddress?.name,
                        status: statusForEmail,
                        trackingId: updatedOrder.trackingId,
                        trackingUrl: updatedOrder.trackingUrl,
                        courier: updatedOrder.courier,
                        orderItems: existingOrder.orderItems
                    })
                });

                const customerEmail = existingOrder.userId?.email
                  || existingOrder.guestEmail
                  || existingOrder.shippingAddress?.email
                  || '';

                await appendOrderCommunicationLog(orderId, {
                    channel: 'email',
                    template: statusForEmail ? `status_${statusForEmail}` : 'tracking_update',
                    label: statusForEmail
                        ? `Status update email (${statusForEmail})`
                        : 'Tracking update email',
                    status: 'sent',
                    recipient: customerEmail,
                    sentByUid: userId,
                    sentByName: sellerName,
                });

                // Send SMS notification if phone number exists
                if (existingOrder.shippingAddress?.phone) {
                    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/order-sms`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            phoneNumber: existingOrder.shippingAddress.phone,
                            orderId: updatedOrder._id.toString(),
                            customerName: existingOrder.userId.name || existingOrder.shippingAddress.name,
                            status: updatedOrder.status,
                            totalAmount: existingOrder.total,
                            trackingId: updatedOrder.trackingId,
                            trackingUrl: updatedOrder.trackingUrl,
                            courier: updatedOrder.courier
                        })
                    }).catch(smsError => {
                        console.error('SMS notification failed:', smsError);
                    });
                }
            } catch (emailError) {
                console.error('Email notification failed:', emailError);
                // Continue even if email fails
            }
        }

        return NextResponse.json({ 
            success: true, 
            order: updatedOrder,
            message: 'Order updated successfully'
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to update order' }, { status: 400 });
    }
}

// Delete order
export async function DELETE(request, { params }) {
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
        const { orderId } = await params;

        // Verify the order belongs to this store
        const existingOrder = await Order.findOne({
            _id: orderId,
            storeId: storeId
        }).lean();

        if (!existingOrder) {
            return NextResponse.json({ error: 'Order not found or unauthorized' }, { status: 404 });
        }

        // Delete the order
        await Order.findByIdAndDelete(orderId);

        return NextResponse.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to delete order' }, { status: 400 });
    }
}
