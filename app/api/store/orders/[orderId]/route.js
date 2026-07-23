import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import User from '@/models/User';
import { appendOrderCommunicationLog } from '@/lib/orderCommunicationLog';
import { ACTIVE_RECORD_FILTER, buildTrashMeta } from '@/lib/storeTrash';
import { getRepairedBundleOrderLine } from '@/lib/bundleOrderRepair';
import { getOrderLineProduct } from '@/lib/orderDisplay';
import { requestWaslahAutoShipment } from '@/lib/waslahAutoShipment';
import { matchVariantByOptions } from '@/lib/productVariantOptions';

const ORDER_LINE_PRODUCT_SELECT = 'name slug images sku variants price salePrice';

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
        );
    }
    return value;
}

function comparableOrderItems(items = []) {
    return (Array.isArray(items) ? items : []).map((item) => ({
        productId: String(item?.productId?._id || item?.productId || ''),
        name: String(item?.name || '').trim(),
        price: Number(Number(item?.price || 0).toFixed(2)),
        quantity: Math.max(1, Number(item?.quantity) || 1),
        variantOptions: stableValue(item?.variantOptions || null),
    }));
}

function changedMoney(next, current) {
    if (next === undefined) return false;
    const nextAmount = Number(next);
    const currentAmount = Number(current || 0);
    if (!Number.isFinite(nextAmount) || !Number.isFinite(currentAmount)) return true;
    return Math.abs(nextAmount - currentAmount) > 0.01;
}

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
            model: 'Product',
            select: ORDER_LINE_PRODUCT_SELECT,
        })
        .lean();

        if (!existingOrder) {
            return NextResponse.json({ error: 'Order not found or unauthorized' }, { status: 404 });
        }

        if (existingOrder.waslah?.autoShipEnrolled === true) {
            const paymentMethodChanged = paymentMethod !== undefined
                && String(paymentMethod || '').trim().toUpperCase()
                    !== String(existingOrder.paymentMethod || '').trim().toUpperCase();
            const paymentStatusChanged = paymentStatus !== undefined
                && String(paymentStatus || '').trim().toUpperCase()
                    !== String(existingOrder.paymentStatus || '').trim().toUpperCase();
            const paidFlagChanged = isPaid !== undefined && Boolean(isPaid) !== Boolean(existingOrder.isPaid);
            const itemsChanged = Array.isArray(orderItems)
                && JSON.stringify(comparableOrderItems(orderItems))
                    !== JSON.stringify(comparableOrderItems(existingOrder.orderItems));
            const referenceId = String(paymentReferenceId || tabbyPaymentId || tamaraOrderId || '').trim();
            const paymentReferenceChanged = Boolean(referenceId)
                && referenceId !== String(
                    existingOrder.paymentReferenceId
                    || existingOrder.tabbyPaymentId
                    || existingOrder.tamaraOrderId
                    || '',
                ).trim();

            if (
                paymentMethodChanged
                || paymentStatusChanged
                || paidFlagChanged
                || changedMoney(shippingFee, existingOrder.shippingFee)
                || changedMoney(total, existingOrder.total)
                || itemsChanged
                || paymentReferenceChanged
            ) {
                return NextResponse.json({
                    error: 'Payment, totals, and items are locked because this new order is enrolled for automatic EMX fulfillment.',
                    code: 'AUTO_EMX_FULFILLMENT_LOCKED',
                }, { status: 409 });
            }
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
            const requestedProductIds = [...new Set(orderItems
                .map((item) => String(item?.productId?._id || item?.productId || '').trim())
                .filter(Boolean))];
            const requestedProducts = requestedProductIds.length
                ? await Product.find({
                    _id: { $in: requestedProductIds },
                    storeId: String(storeId),
                })
                    .select(ORDER_LINE_PRODUCT_SELECT)
                    .lean()
                : [];
            const productById = new Map(
                requestedProducts.map((product) => [String(product._id), product]),
            );

            const missingProductId = requestedProductIds.find((id) => !productById.has(id));
            if (missingProductId) {
                return NextResponse.json({
                    error: 'One of the selected products was not found in this store.',
                }, { status: 400 });
            }

            updateData.orderItems = orderItems.map((item, index) => {
                const existingItem = existingOrder.orderItems?.[index] || {};
                const requestedProductId = String(
                    item?.productId?._id || item?.productId || '',
                ).trim();
                const existingProduct = getOrderLineProduct(existingItem);
                const product = productById.get(requestedProductId)
                    || (existingProduct?._id ? existingProduct : {});
                const requestedVariantOptions = item?.variantOptions
                    && typeof item.variantOptions === 'object'
                    ? item.variantOptions
                    : null;
                const matchedVariant = requestedVariantOptions
                    && Array.isArray(product?.variants)
                    && product.variants.length
                    ? matchVariantByOptions(product.variants, requestedVariantOptions)
                    : null;

                if (
                    requestedVariantOptions
                    && Array.isArray(product?.variants)
                    && product.variants.length
                    && !matchedVariant
                ) {
                    throw new Error(`Select a valid bundle or variant for item ${index + 1}.`);
                }

                const base = {
                    productId: item?.productId?._id || item?.productId || existingItem?.productId?._id || existingItem?.productId || undefined,
                    name: String(item?.name || '').trim(),
                    price: Number(item?.price) || 0,
                    quantity: Math.max(1, Number(item?.quantity) || 1),
                    ...(requestedVariantOptions
                        ? {
                            variantOptions: {
                                ...(matchedVariant?.options || {}),
                                ...requestedVariantOptions,
                            },
                        }
                        : {}),
                };
                return getRepairedBundleOrderLine(base, product, existingOrder) || base;
            }).filter((item) => item.name && item.quantity > 0);
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
            select: ORDER_LINE_PRODUCT_SELECT,
        })
        .lean();

        if (updatedOrder?.waslah?.autoShipEnrolled === true && !updatedOrder.trackingId) {
            await requestWaslahAutoShipment(updatedOrder, {
                source: 'eligible_order_details_updated',
            });
        }

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
            storeId: storeId,
            ...ACTIVE_RECORD_FILTER,
        }).lean();

        if (!existingOrder) {
            return NextResponse.json({ error: 'Order not found or unauthorized' }, { status: 404 });
        }

        await Order.findByIdAndUpdate(orderId, {
            $set: buildTrashMeta(userId, decodedToken.name || decodedToken.email || 'Store staff'),
        });

        return NextResponse.json({ success: true, message: 'Order moved to trash' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to delete order' }, { status: 400 });
    }
}
