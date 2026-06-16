import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request) {
  try {
    // Rate limiting: 5 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const rateLimitResult = rateLimit(`razorpay-order:${ip}`, 5, 60000);
    
    if (!rateLimitResult.allowed) {
      console.warn('[Razorpay Order] Rate limit exceeded for IP:', ip);
      return NextResponse.json({
        error: rateLimitResult.message,
        retryAfter: rateLimitResult.waitTime
      }, { 
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.waitTime.toString()
        }
      });
    }

    const { amount, currency = "AED", receipt } = await request.json();

    // Validate inputs
    if (!amount || amount <= 0) {
      console.error('[Razorpay Order] Invalid amount:', amount);
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    // Check environment variables
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('[Razorpay Order] Missing API credentials');
      return NextResponse.json({ 
        error: "Payment system not configured properly" 
      }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    console.log('[Razorpay Order] Creating order:', { amount, currency });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise, ensure integer
      currency: currency,
      receipt: receipt || `order_${Date.now()}`,
    });

    console.log('[Razorpay Order] Order created successfully:', order.id);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("[Razorpay Order] Error:", error);
    console.error("[Razorpay Order] Stack:", error.stack);
    
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to create order",
    }, { status: 500 });
  }
}
