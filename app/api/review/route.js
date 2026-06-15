import { uploadToS3 } from '@/lib/storage';
import connectDB from '@/lib/mongodb';
import Rating from '@/models/Rating';
import Order from '@/models/Order';
import User from '@/models/User';


// POST: Customer adds a review with images
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
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const productId = formData.get('productId');
        const rating = Number(formData.get('rating'));
        const review = formData.get('review');
        const images = formData.getAll('images');
        const videos = formData.getAll('videos');

        if (!productId || !rating || !review) {
            return Response.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check if customer has purchased this product
        const purchasedOrder = await Order.findOne({
            userId,
            'orderItems.productId': productId,
            status: { $in: ['DELIVERED', 'SHIPPED', 'ORDER_PLACED'] }
        }).select('_id').lean();

        if (!purchasedOrder) {
            return Response.json({ 
                error: "You can only review products you have purchased" 
            }, { status: 403 });
        }

        // Upload images to S3
        let imageUrls = [];
        if (images.length > 0) {
            imageUrls = await Promise.all(
                images.map(async (image) => {
                    const buffer = Buffer.from(await image.arrayBuffer());
                    const response = await uploadToS3({
                        buffer,
                        fileName: `review_${Date.now()}_${image.name}`,
                        folder: "uploads",
                        contentType: image.type || undefined,
                    });
                    return response.url;
                })
            );
        }

        // Create or update review (requires approval)
        const newReview = await Rating.findOneAndUpdate(
            { userId, productId },
            {
                rating,
                review,
                images: imageUrls,
                orderId: purchasedOrder._id.toString(),
                approved: false
            },
            { upsert: true, new: true }
        );

        // Populate user
        const user = await User.findById(userId).select('_id name image').lean();

        return Response.json({
            success: true,
            message: "Review submitted successfully and pending approval",
            review: { ...newReview.toObject(), user }
        });

    } catch (error) {
        console.error('Review submission error:', error);
        return Response.json({
            error: error.message || "Failed to submit review"
        }, { status: 500 });
    }
}

// GET: Fetch reviews for a product
export async function GET(request) {
    try {
        await connectDB();
        
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');

        if (!productId) {
            return Response.json({ error: "Product ID required" }, { status: 400 });
        }

        // Only show approved reviews to customers
        const reviews = await Rating.find({ 
            productId,
            approved: true 
        })
        .sort({ createdAt: -1 })
        .lean();

        // Enrich reviews with user data
        const enrichedReviews = await Promise.all(
            reviews.map(async (review) => {
                let userData = null;
                // Try to populate if userId is a valid ObjectId
                if (typeof review.userId === 'string' && review.userId.match(/^[a-fA-F0-9]{24}$/)) {
                    userData = await User.findById(review.userId).select('_id name image email').lean();
                }
                // If no userData found, use customerName from review
                return {
                    ...review,
                    user: userData || { 
                        name: review.customerName || 'Guest', 
                        email: review.customerEmail,
                        image: '/placeholder-avatar.png'
                    }
                };
            })
        );

        return Response.json({ reviews: enrichedReviews });

    } catch (error) {
        console.error('Fetch reviews error:', error);
        return Response.json({
            error: error.message || "Failed to fetch reviews"
        }, { status: 500 });
    }
}
