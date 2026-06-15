import authSeller from "@/middlewares/authSeller";
import { uploadToS3 } from '@/lib/storage';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Rating from '@/models/Rating';
import User from '@/models/User';


// GET: Fetch all reviews for store's products
export async function GET(request) {
    try {
        await connectDB();
        
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
        } catch (err) {
            return Response.json({ error: 'Invalid or expired token' }, { status: 401 });
        }
        const userId = decodedToken.uid;

        const storeId = await authSeller(userId);
        if (!storeId) {
            return Response.json({ error: "Not authorized" }, { status: 401 });
        }

        // Get all products for this store
        const products = await Product.find({ storeId })
          .select('_id name slug price mrp AED images category inStock')
          .lean();
        const productIds = products.map(p => p._id.toString());
        
        // Get ratings for these products
        const ratings = await Rating.find({ productId: { $in: productIds } })
            .sort({ createdAt: -1 })
            .lean();
        
        // Populate user data for ratings
        const enrichedRatings = await Promise.all(
            ratings.map(async (rating) => {
                let userData = null;
                // Try to populate if userId is a valid ObjectId
                if (typeof rating.userId === 'string' && rating.userId.match(/^[a-fA-F0-9]{24}$/)) {
                    userData = await User.findById(rating.userId).select('_id name email image').lean();
                } else if (typeof rating.userId === 'object' && rating.userId?._id) {
                    userData = rating.userId;
                }
                // If no userData found, use customerName/customerEmail from rating
                return {
                    ...rating,
                    user: userData || { 
                        name: rating.customerName || 'Guest', 
                        email: rating.customerEmail,
                        image: '/placeholder-avatar.png'
                    }
                };
            })
        );
        
        // Attach ratings to products
        const productsWithRatings = products.map(product => ({
            ...product,
            rating: enrichedRatings.filter(r => r.productId === product._id.toString())
        }));

        return Response.json({ products: productsWithRatings });

    } catch (error) {
        console.error('Fetch store reviews error:', error);
        return Response.json({
            error: error.message || "Failed to fetch reviews"
        }, { status: 500 });
    }
}

// POST: Store manually adds a review for a product
export async function POST(request) {
    try {
        await connectDB();
        
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
        } catch (err) {
            return Response.json({ error: 'Invalid or expired token' }, { status: 401 });
        }
        const userId = decodedToken.uid;

        const storeId = await authSeller(userId);
        if (!storeId) {
            return Response.json({ error: "Not authorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const productId = formData.get('productId');
        const rating = Number(formData.get('rating'));
        const review = formData.get('review');
        const customerName = formData.get('customerName');
        const customerEmail = formData.get('customerEmail');
        const images = formData.getAll('images');
        const videos = formData.getAll('videos');

        if (!productId || !rating || !review || !customerName || !customerEmail) {
            return Response.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Validate productId
        if (!productId || typeof productId !== 'string' || !productId.match(/^[a-fA-F0-9]{24}$/)) {
            console.error('Invalid or missing productId:', productId);
            return Response.json({ error: "Product ID required or invalid format" }, { status: 400 });
        }

        // Verify product belongs to this store
        let product;
        try {
            product = await Product.findOne({
                _id: productId,
                storeId
            }).lean();
        } catch (err) {
            console.error('Product.findOne error:', err, 'productId:', productId);
            return Response.json({ error: "Invalid productId format" }, { status: 400 });
        }

        if (!product) {
            return Response.json({ error: "Product not found or not authorized" }, { status: 403 });
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

        // Upload videos to S3
        let videoUrls = [];
        if (videos.length > 0) {
            videoUrls = await Promise.all(
                videos.map(async (video) => {
                    const buffer = Buffer.from(await video.arrayBuffer());
                    const response = await uploadToS3({
                        buffer,
                        fileName: `review_video_${Date.now()}_${video.name}`,
                        folder: "uploads",
                        contentType: video.type || undefined,
                    });
                    return response.url;
                })
            );
        }

        // Find or create user for this email
        let user = await User.findOne({ email: customerEmail }).lean();

        if (!user) {
            // Create a placeholder user
            user = await User.create({
                _id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                email: customerEmail,
                name: customerName,
                image: '/placeholder-avatar.png'
            });
        }

        // Create review (manually added reviews are auto-approved)
        const newReview = await Rating.create({
            userId: user._id.toString(),
            productId,
            rating,
            review,
            images: imageUrls,
            videos: videoUrls,
            customerName,
            customerEmail,
            approved: true
        });

        // Return review with user data
        const populatedReview = {
            ...newReview.toObject(),
            user: {
                _id: user._id,
                name: user.name,
                image: user.image
            }
        };

        return Response.json({
            success: true,
            message: "Review added successfully",
            review: populatedReview
        });

    } catch (error) {
        console.error('Manual review submission error:', error);
        return Response.json({
            error: error.message || "Failed to submit review"
        }, { status: 500 });
    }
}
