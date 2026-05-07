import { getAuth } from 'firebase-admin/auth';
import Order from '@/models/Order';
import { connectDB } from '@/lib/mongoose';
import { verifyAuth } from '@/middlewares/authMiddleware';

export async function POST(request) {
  try {
    await connectDB();
    
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const userId = authResult.userId;
    const body = await request.json();
    
    const { orderId, rating, reviewText, images } = body;

    if (!orderId || !rating || !reviewText) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: orderId, rating, reviewText'
      }), { status: 400 });
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return new Response(JSON.stringify({
        error: 'Rating must be an integer between 1 and 5'
      }), { status: 400 });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
    }

    // Verify the order belongs to the user
    if (order.userId?.toString() !== userId && order.email !== authResult.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized - this order does not belong to you' }), { status: 403 });
    }

    // Initialize deliveryReviews array if it doesn't exist
    if (!order.deliveryReviews) {
      order.deliveryReviews = [];
    }

    // Check if already reviewed
    if (order.deliveryReviews.some(r => r.userId?.toString() === userId)) {
      return new Response(JSON.stringify({
        error: 'You have already reviewed this order'
      }), { status: 400 });
    }

    // Add the delivery review
    const newReview = {
      userId,
      rating,
      reviewText,
      images: Array.isArray(images) ? images : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    order.deliveryReviews.push(newReview);
    
    // Calculate average rating
    const allRatings = order.deliveryReviews.map(r => r.rating);
    order.averageDeliveryRating = allRatings.length > 0 
      ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2)
      : 0;

    await order.save();

    return new Response(JSON.stringify({
      message: 'Delivery review submitted successfully',
      review: newReview,
      order
    }), { status: 200 });

  } catch (error) {
    console.error('[API] Delivery review error:', error);
    return new Response(JSON.stringify({
      error: error?.message || 'Failed to submit delivery review'
    }), { status: 500 });
  }
}
