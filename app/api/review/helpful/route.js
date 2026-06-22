import connectDB from '@/lib/mongodb';
import Rating from '@/models/Rating';
import { deleteCacheKey } from '@/lib/cache';

export async function POST(request) {
  try {
    const body = await request.json();
    const reviewId = String(body?.reviewId || '').trim();
    const voterId = String(body?.voterId || '').trim();

    if (!reviewId) {
      return Response.json({ error: 'Review ID is required' }, { status: 400 });
    }

    if (!voterId || voterId.length < 8) {
      return Response.json({ error: 'Voter ID is required' }, { status: 400 });
    }

    await connectDB();

    const review = await Rating.findById(reviewId).select('productId helpfulCount helpfulVoters').lean();
    if (!review) {
      return Response.json({ error: 'Review not found' }, { status: 404 });
    }

    const voters = Array.isArray(review.helpfulVoters) ? review.helpfulVoters : [];
    if (voters.includes(voterId)) {
      return Response.json({
        success: true,
        alreadyVoted: true,
        helpfulCount: Number(review.helpfulCount || 0),
      });
    }

    const updated = await Rating.findByIdAndUpdate(
      reviewId,
      {
        $inc: { helpfulCount: 1 },
        $addToSet: { helpfulVoters: voterId },
      },
      { new: true }
    ).select('helpfulCount').lean();

    if (review.productId) {
      deleteCacheKey(`reviews:product:${review.productId}`);
    }

    return Response.json({
      success: true,
      alreadyVoted: false,
      helpfulCount: Number(updated?.helpfulCount || 0),
    });
  } catch (error) {
    console.error('Review helpful vote error:', error);
    return Response.json({ error: error.message || 'Failed to record helpful vote' }, { status: 500 });
  }
}
