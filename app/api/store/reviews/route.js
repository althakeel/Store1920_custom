import authSeller from '@/middlewares/authSeller';
import { uploadToS3 } from '@/lib/storage';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Rating from '@/models/Rating';
import User from '@/models/User';
import { buildReviewSummary, enrichRatingUser } from '@/lib/storeReviewsApi';

function getDefaultReviewDate() {
  return new Date();
}

function parseReviewDateInput(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return getDefaultReviewDate();

  const parsed = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return getDefaultReviewDate();

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (parsed > endOfToday) return getDefaultReviewDate();

  return parsed;
}

function parsePositiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

async function authenticateStore(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
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
  } catch {
    return { error: Response.json({ error: 'Invalid or expired token' }, { status: 401 }) };
  }

  const storeId = await authSeller(decodedToken.uid);
  if (!storeId) {
    return { error: Response.json({ error: 'Not authorized' }, { status: 401 }) };
  }

  return { storeId };
}

async function getStoreProductIds(storeId) {
  const products = await Product.find({ storeId }).select('_id').lean();
  return products.map((product) => String(product._id));
}

async function getStoreReviewStats(storeId, productIds) {
  const [statsAgg, totalProducts] = await Promise.all([
    Rating.aggregate([
      { $match: { productId: { $in: productIds } } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          pendingReviews: {
            $sum: {
              $cond: [{ $eq: ['$approved', false] }, 1, 0],
            },
          },
          approvedRatingSum: {
            $sum: {
              $cond: [{ $eq: ['$approved', true] }, '$rating', 0],
            },
          },
          approvedCount: {
            $sum: {
              $cond: [{ $eq: ['$approved', true] }, 1, 0],
            },
          },
          productsWithReviews: { $addToSet: '$productId' },
        },
      },
    ]),
    Product.countDocuments({ storeId }),
  ]);

  const stats = statsAgg[0] || {};
  const withReviews = Array.isArray(stats.productsWithReviews) ? stats.productsWithReviews.length : 0;
  const approvedCount = Number(stats.approvedCount || 0);

  return {
    totalReviews: Number(stats.totalReviews || 0),
    pendingReviews: Number(stats.pendingReviews || 0),
    averageRating: approvedCount > 0 ? Number(stats.approvedRatingSum || 0) / approvedCount : 0,
    withReviews,
    noReviews: Math.max(0, totalProducts - withReviews),
    totalProducts,
  };
}

async function getRatingSummaryMap(productIds) {
  const summaries = await Rating.aggregate([
    { $match: { productId: { $in: productIds } } },
    {
      $group: {
        _id: '$productId',
        reviewCount: { $sum: 1 },
        pendingCount: {
          $sum: {
            $cond: [{ $eq: ['$approved', false] }, 1, 0],
          },
        },
        approvedRatingSum: {
          $sum: {
            $cond: [{ $eq: ['$approved', true] }, '$rating', 0],
          },
        },
        approvedCount: {
          $sum: {
            $cond: [{ $eq: ['$approved', true] }, 1, 0],
          },
        },
      },
    },
  ]);

  return new Map(
    summaries.map((summary) => [String(summary._id), buildReviewSummary(summary)])
  );
}

async function fetchProductReviews(productId, storeId) {
  const product = await Product.findOne({ _id: productId, storeId })
    .select('_id name slug sku images externalImages')
    .lean();

  if (!product) {
    return { error: Response.json({ error: 'Product not found or not authorized' }, { status: 404 }) };
  }

  const ratings = await Rating.find({ productId: String(productId) })
    .sort({ createdAt: -1 })
    .lean();

  const objectIdUserIds = ratings
    .map((rating) => rating.userId)
    .filter((userId) => typeof userId === 'string' && /^[a-fA-F0-9]{24}$/.test(userId));

  const users = objectIdUserIds.length
    ? await User.find({ _id: { $in: objectIdUserIds } }).select('_id name email image').lean()
    : [];

  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return {
    product,
    reviews: ratings.map((rating) => enrichRatingUser(rating, userMap)),
  };
}

export async function GET(request) {
  try {
    await connectDB();

    const auth = await authenticateStore(request);
    if (auth.error) return auth.error;

    const { storeId } = auth;
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    const productIds = await getStoreProductIds(storeId);

    if (productId) {
      const result = await fetchProductReviews(productId, storeId);
      if (result.error) return result.error;
      return Response.json(result);
    }

    const page = parsePositiveInt(searchParams.get('page'), 1);
    const limit = parsePositiveInt(searchParams.get('limit'), 15, 50);
    const search = String(searchParams.get('search') || '').trim();
    const filter = String(searchParams.get('filter') || 'all');

    const [stats, summaryMap] = await Promise.all([
      getStoreReviewStats(storeId, productIds),
      getRatingSummaryMap(productIds),
    ]);

    const productQuery = { storeId };

    if (search) {
      productQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    if (filter === 'with-reviews') {
      const idsWithReviews = [...summaryMap.entries()]
        .filter(([, summary]) => summary.count > 0)
        .map(([id]) => id);
      productQuery._id = { $in: idsWithReviews };
    } else if (filter === 'no-reviews') {
      const idsWithReviews = [...summaryMap.entries()]
        .filter(([, summary]) => summary.count > 0)
        .map(([id]) => id);
      productQuery._id = { $nin: idsWithReviews };
    } else if (filter === 'pending') {
      const idsWithPending = [...summaryMap.entries()]
        .filter(([, summary]) => summary.pendingCount > 0)
        .map(([id]) => id);
      productQuery._id = { $in: idsWithPending };
    }

    const skip = (page - 1) * limit;

    const [products, totalProducts] = await Promise.all([
      Product.find(productQuery)
        .select('_id name slug sku price mrp AED images externalImages category inStock')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(productQuery),
    ]);

    const productsWithSummary = products.map((product) => ({
      ...product,
      reviewSummary: summaryMap.get(String(product._id)) || buildReviewSummary(),
    }));

    return Response.json({
      products: productsWithSummary,
      pagination: {
        page,
        limit,
        totalProducts,
        totalPages: Math.max(1, Math.ceil(totalProducts / limit)),
      },
      stats,
      filterCounts: {
        all: stats.totalProducts,
        withReviews: stats.withReviews,
        noReviews: stats.noReviews,
        pending: [...summaryMap.values()].filter((summary) => summary.pendingCount > 0).length,
      },
    });
  } catch (error) {
    console.error('Fetch store reviews error:', error);
    return Response.json({
      error: error.message || 'Failed to fetch reviews',
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectDB();

    const auth = await authenticateStore(request);
    if (auth.error) return auth.error;

    const { storeId } = auth;

    const formData = await request.formData();
    const productId = formData.get('productId');
    const rating = Number(formData.get('rating'));
    const review = formData.get('review');
    const customerName = formData.get('customerName');
    const customerEmail = formData.get('customerEmail');
    const reviewDateInput = formData.get('reviewDate');
    const images = formData.getAll('images');
    const videos = formData.getAll('videos');

    if (!productId || !rating || !review || !customerName || !customerEmail) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!productId || typeof productId !== 'string' || !productId.match(/^[a-fA-F0-9]{24}$/)) {
      return Response.json({ error: 'Product ID required or invalid format' }, { status: 400 });
    }

    let product;
    try {
      product = await Product.findOne({
        _id: productId,
        storeId,
      }).lean();
    } catch (err) {
      console.error('Product.findOne error:', err, 'productId:', productId);
      return Response.json({ error: 'Invalid productId format' }, { status: 400 });
    }

    if (!product) {
      return Response.json({ error: 'Product not found or not authorized' }, { status: 403 });
    }

    let imageUrls = [];
    if (images.length > 0) {
      imageUrls = await Promise.all(
        images.map(async (image) => {
          const buffer = Buffer.from(await image.arrayBuffer());
          const response = await uploadToS3({
            buffer,
            fileName: `review_${Date.now()}_${image.name}`,
            folder: 'uploads',
            contentType: image.type || undefined,
          });
          return response.url;
        })
      );
    }

    let videoUrls = [];
    if (videos.length > 0) {
      videoUrls = await Promise.all(
        videos.map(async (video) => {
          const buffer = Buffer.from(await video.arrayBuffer());
          const response = await uploadToS3({
            buffer,
            fileName: `review_video_${Date.now()}_${video.name}`,
            folder: 'uploads',
            contentType: video.type || undefined,
          });
          return response.url;
        })
      );
    }

    let user = await User.findOne({ email: customerEmail }).lean();

    if (!user) {
      user = await User.create({
        _id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: customerEmail,
        name: customerName,
        image: '/placeholder-avatar.png',
      });
    }

    const reviewCreatedAt = parseReviewDateInput(reviewDateInput);
    const newReview = await Rating.create({
      userId: user._id.toString(),
      productId,
      rating,
      review,
      images: imageUrls,
      videos: videoUrls,
      customerName,
      customerEmail,
      approved: true,
      createdAt: reviewCreatedAt,
      updatedAt: reviewCreatedAt,
    });

    const populatedReview = {
      ...newReview.toObject(),
      user: {
        _id: user._id,
        name: user.name,
        image: user.image,
      },
    };

    return Response.json({
      success: true,
      message: 'Review added successfully',
      review: populatedReview,
    });
  } catch (error) {
    console.error('Manual review submission error:', error);
    return Response.json({
      error: error.message || 'Failed to submit review',
    }, { status: 500 });
  }
}
