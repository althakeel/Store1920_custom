import { uploadToS3 } from '@/lib/storage';
import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import ReturnRequest from '@/models/ReturnRequest';
import Order from '@/models/Order';

// Get user's return requests
export async function GET(request) {
    try {
        await connectDB();
        
        // Firebase Auth
        const authHeader = request.headers.get('authorization');
        let userId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            const { getAuth } = await import('firebase-admin/auth');
            const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
            if (getApps().length === 0) {
                initializeApp({ credential: applicationDefault() });
            }
            try {
                const decodedToken = await getAuth().verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (e) {
                userId = null;
            }
        }

        if (!userId) {
            return NextResponse.json({ error: "not authorized" }, { status: 401 });
        }

        const requests = await ReturnRequest.find({ userId })
            .populate({
                path: 'storeId',
                select: 'name username'
            })
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json({ requests });
    } catch (error) {
        console.error('Error fetching return requests:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Create return/replacement request
export async function POST(request) {
    try {
        await connectDB();
        
        // Firebase Auth
        const authHeader = request.headers.get('authorization');
        let userId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            const { getAuth } = await import('firebase-admin/auth');
            const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
            if (getApps().length === 0) {
                initializeApp({ credential: applicationDefault() });
            }
            try {
                const decodedToken = await getAuth().verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (e) {
                userId = null;
            }
        }

        if (!userId) {
            return NextResponse.json({ error: "not authorized" }, { status: 401 });
        }

        const contentType = request.headers.get('content-type') || '';

        let orderId, type, reason, description, fastProcess;
        let images = [];
        let videos = [];
        let productRating = null;
        let deliveryRating = null;
        let reviewText = null;

        if (contentType.includes('multipart/form-data')) {
            // Handle form-data submission with file uploads
            const form = await request.formData();
            orderId = form.get('orderId');
            type = form.get('type');
            reason = form.get('reason');
            description = form.get('description') || '';
            fastProcess = (form.get('fastProcess') === 'true');
            productRating = form.get('productRating') ? Number(form.get('productRating')) : null;
            deliveryRating = form.get('deliveryRating') ? Number(form.get('deliveryRating')) : null;
            reviewText = form.get('reviewText') || null;

            // Upload images
            const imageFiles = form.getAll('images');
            if (imageFiles && imageFiles.length > 0) {
                const uploaded = await Promise.all(
                    imageFiles.map(async (file) => {
                        if (typeof file === 'string') return file; // in case URL passed
                        const buffer = Buffer.from(await file.arrayBuffer());
                        const resp = await uploadToS3({
                            buffer,
                            fileName: `return_${Date.now()}_${file.name}`,
                            folder: "uploads",
                            contentType: file.type || undefined,
                        });
                        return resp.url;
                    })
                );
                images = uploaded;
            }

            // Upload videos (optional, single or multiple)
            const videoFiles = form.getAll('videos');
            if (videoFiles && videoFiles.length > 0) {
                const uploadedVids = await Promise.all(
                    videoFiles.map(async (file) => {
                        if (typeof file === 'string') return file;
                        const buffer = Buffer.from(await file.arrayBuffer());
                        const resp = await uploadToS3({
                            buffer,
                            fileName: `return_${Date.now()}_${file.name}`,
                            folder: "uploads",
                            contentType: file.type || undefined,
                        });
                        return resp.url;
                    })
                );
                videos = uploadedVids;
            }
        } else {
            // Handle JSON body (backward compatible)
            const body = await request.json();
            orderId = body.orderId;
            type = body.type;
            reason = body.reason;
            description = body.description || '';
            images = body.images || [];
            videos = body.videos || [];
            fastProcess = body.fastProcess || false;
            productRating = body.productRating ?? null;
            deliveryRating = body.deliveryRating ?? null;
            reviewText = body.reviewText ?? null;
        }

        if (!orderId || !type || !reason) {
            return NextResponse.json({ error: "missing required fields" }, { status: 400 });
        }

        // Verify order exists and belongs to user
        const order = await Order.findOne({ _id: orderId, userId }).lean();

        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        // Check if order was delivered and within allowed window per type (Return: 7 days, Replacement: 15 days)
        if (order.status !== 'DELIVERED') {
            return NextResponse.json({ error: "Order must be delivered to request return/replacement" }, { status: 400 });
        }

        const deliveredDate = order.updatedAt;
        const daysSinceDelivery = Math.floor((new Date() - deliveredDate) / (1000 * 60 * 60 * 24));
        const maxDays = (type === 'REPLACEMENT') ? 15 : 7;

        if (daysSinceDelivery > maxDays) {
            const msg = type === 'REPLACEMENT'
                ? "Replacement window has expired (15 days from delivery)"
                : "Return window has expired (7 days from delivery)";
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        // Check if all products in the order allow returns/replacements
        const orderWithItems = await Order.findById(orderId)
            .populate({
                path: 'orderItems.productId',
                model: 'Product'
            })
            .lean();

        const invalidProducts = orderWithItems.orderItems.filter(item => {
            if (type === 'RETURN' && !item.productId.allowReturn) {
                return true;
            }
            if (type === 'REPLACEMENT' && !item.productId.allowReplacement) {
                return true;
            }
            return false;
        });

        if (invalidProducts.length > 0) {
            const productNames = invalidProducts.map(item => item.productId.name).join(', ');
            return NextResponse.json({ 
                error: `The following products do not allow ${type.toLowerCase()}: ${productNames}` 
            }, { status: 400 });
        }

        // Check if request already exists for this order
        const existingRequest = await ReturnRequest.findOne({ orderId, userId }).lean();

        if (existingRequest) {
            return NextResponse.json({ error: "Return/replacement request already exists for this order" }, { status: 400 });
        }

        // Create return request
        const returnRequest = await ReturnRequest.create({
            orderId,
            userId,
            storeId: order.storeId,
            type,
            reason,
            description: description || '',
            images: images || [],
            videos: videos || [],
            fastProcess: fastProcess || false,
            productRating: productRating ?? null,
            deliveryRating: deliveryRating ?? null,
            reviewText: reviewText ?? null
        });

        return NextResponse.json({ 
            message: "Return/replacement request submitted successfully",
            request: returnRequest 
        });
    } catch (error) {
        console.error('Error creating return request:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
