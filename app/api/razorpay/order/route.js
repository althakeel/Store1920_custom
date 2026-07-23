import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { checkRateLimit, getClientIp } from "@/lib/apiSecurity";
import { razorpayOrderCreateSchema } from "@/lib/apiSchemas";
import { parseJsonBody } from "@/lib/apiValidate";

export async function POST(request) {
  try {
    // Defense-in-depth: route-level limit (proxy also throttles /api/razorpay)
    const ip = getClientIp(request);
    const rateLimitResult = checkRateLimit(`razorpay-order:${ip}`, 5, 60000);

    if (!rateLimitResult.allowed) {
      console.warn('[Razorpay Order] Rate limit exceeded for IP:', ip);
      return NextResponse.json({
        error: rateLimitResult.waitTime
          ? `Rate limit exceeded. Try again in ${rateLimitResult.waitTime} seconds.`
          : 'Rate limit exceeded',
        retryAfter: rateLimitResult.waitTime
      }, {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.waitTime || 60),
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': '0',
        }
      });
    }

    const parsed = await parseJsonBody(request, razorpayOrderCreateSchema);
    if (parsed.error) return parsed.error;
    const { amount, currency = "AED", receipt } = parsed.data;

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
