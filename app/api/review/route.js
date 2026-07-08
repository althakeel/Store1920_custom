import { uploadToS3 } from '@/lib/storage';
import connectDB from '@/lib/mongodb';
import Rating from '@/models/Rating';
import Order from '@/models/Order';
import User from '@/models/User';
import { getAuth } from '@/lib/firebase-admin';
import { findDeliveredOrderForProduct } from '@/lib/reviewEligibility';


// POST: Customer adds a review with images
export async function POST(request) {
    try {
        await connectDB();
        
        const authHeader = request.headers.get('authorization');
        let userId = null;
        let userEmail = '';
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const decodedToken = await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
                userId = decodedToken.uid;
                userEmail = decodedToken.email || '';
            } catch {
                userId = null;
            }
        }

        if (!userId) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const productId = String(formData.get('productId') || '').trim();
        const rating = Number(formData.get('rating'));
        const review = formData.get('review');
        const images = formData.getAll('images');

        if (!productId || !rating || !review) {
            return Response.json({ error: "Missing required fields" }, { status: 400 });
        }

        const deliveredOrder = await findDeliveredOrderForProduct(Order, userId, productId, userEmail);

        if (!deliveredOrder) {
            return Response.json({ 
                error: "You can review this product after your order is delivered" 
            }, { status: 403 });
        }

        const existingReview = await Rating.findOne({ userId, productId }).select('_id approved').lean();
        if (existingReview) {
            return Response.json({
                error: existingReview.approved
                    ? 'You already reviewed this product'
                    : 'Your review is already pending approval',
            }, { status: 409 });
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
                orderId: deliveredOrder._id.toString(),
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
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');

        if (!productId) {
            return Response.json({ error: "Product ID required" }, { status: 400 });
        }

        const { getCachedData, setCachedData } = await import('@/lib/cache');
        const cacheKey = `reviews:product:${productId}`;
        const cached = getCachedData(cacheKey);
        if (cached) {
            const isDev = process.env.NODE_ENV !== 'production';
            return Response.json(cached, {
                headers: {
                    'Cache-Control': isDev ? 'no-store' : 'public, s-maxage=120, stale-while-revalidate=300',
                    'X-Cache': 'HIT',
                },
            });
        }

        await connectDB();

        const reviews = await Rating.find({
            productId: String(productId),
            approved: true,
        })
            .sort({ createdAt: -1 })
            .limit(30)
            .select('_id rating review images videos customerName customerEmail userId orderId helpfulCount createdAt')
            .lean();

        const userIds = [
            ...new Set(
                reviews
                    .map((review) => String(review.userId || '').trim())
                    .filter((id) => /^[a-fA-F0-9]{24}$/.test(id))
            ),
        ];

        const users = userIds.length
            ? await User.find({ _id: { $in: userIds } }).select('_id name image email').lean()
            : [];

        const userMap = new Map(users.map((user) => [String(user._id), user]));

        const enrichedReviews = reviews.map((review) => ({
            ...review,
            user: userMap.get(String(review.userId)) || {
                name: review.customerName || 'Guest',
                email: review.customerEmail,
                image: '/placeholder-avatar.png',
            },
        }));

        const payload = { reviews: enrichedReviews };
        setCachedData(cacheKey, payload, 120);

        const isDev = process.env.NODE_ENV !== 'production';
        return Response.json(payload, {
            headers: {
                'Cache-Control': isDev ? 'no-store' : 'public, s-maxage=120, stale-while-revalidate=300',
                'X-Cache': 'MISS',
            },
        });

    } catch (error) {
        console.error('Fetch reviews error:', error);
        return Response.json({
            error: error.message || "Failed to fetch reviews"
        }, { status: 500 });
    }
}
