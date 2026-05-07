import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Coupon from "@/models/Coupon";
import Order from "@/models/Order";

// GET - Fetch active coupons for display
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId");

    if (!storeId) {
      return NextResponse.json(
        { error: "Store ID is required" },
        { status: 400 }
      );
    }

    await connectDB();

    console.log('=== COUPONS API GET ===');
    console.log('Requested storeId:', storeId);

    const now = new Date();
    
    // Get all coupons for this store - both active and expired (for display)
    const allCoupons = await Coupon.find({ storeId }).lean();
    console.log('Total coupons for this storeId:', allCoupons.length);
    
    // Also check if coupons exist with different storeId format
    const allCouponsAnyStore = await Coupon.find({}).lean();
    console.log('Total coupons in entire DB:', allCouponsAnyStore.length);
    
    if (allCouponsAnyStore.length > 0 && allCoupons.length === 0) {
      console.warn('⚠️ STOREID MISMATCH DETECTED!');
      console.warn('Coupons exist but with different storeId:');
      allCouponsAnyStore.forEach(c => {
        console.warn(`  - ${c.code}: storeId="${c.storeId}" (requested: "${storeId}")`);
      });
    }
    
    // Separate active and expired coupons
    const coupons = allCoupons
      .filter(c => c.isActive)
      .map(coupon => {
        const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < now;
        const isExhausted = coupon.maxUses && coupon.usedCount >= coupon.maxUses;
        
        return {
          _id: coupon._id,
          code: coupon.code,
          title: coupon.title || `${coupon.discountValue || coupon.discount}${coupon.discountType === 'percentage' ? '%' : 'AED'} Off`,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue || coupon.discount,
          freeShipping: Boolean(coupon.freeShipping),
          minOrderValue: coupon.minOrderValue || coupon.minPrice || 0,
          maxDiscount: coupon.maxDiscount,
          badgeColor: coupon.badgeColor || '#10B981',
          specificProducts: coupon.specificProducts || [],
          expiresAt: coupon.expiresAt,
          isExpired,
          isExhausted,
          usedCount: coupon.usedCount,
          maxUses: coupon.maxUses,
          status: isExpired ? 'expired' : isExhausted ? 'exhausted' : 'active',
        };
      });

    console.log('Active coupons found:', coupons.length, coupons.map(c => ({ code: c.code, status: c.status })));

    return NextResponse.json({ success: true, coupons });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return NextResponse.json(
      { error: "Failed to fetch coupons" },
      { status: 500 }
    );
  }
}

// POST - Validate and apply coupon
export async function POST(request) {
  try {
    const body = await request.json();
    const { code, storeId, orderTotal, userId, cartProductIds } = body;

    if (!code || !storeId || orderTotal === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await connectDB();

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      storeId,
      isActive: true,
    });

    if (!coupon) {
      return NextResponse.json(
        { error: "Invalid coupon code", valid: false },
        { status: 400 }
      );
    }

    // Check if expired
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Coupon has expired", valid: false },
        { status: 400 }
      );
    }

    // Check minimum order value
    if (orderTotal < (coupon.minOrderValue || coupon.minPrice || 0)) {
      const minAmount = coupon.minOrderValue || coupon.minPrice || 0;
      return NextResponse.json(
        {
          error: `Minimum order value of AED${minAmount} required`,
          valid: false,
        },
        { status: 400 }
      );
    }

    // Check if coupon is for specific products
    if (coupon.specificProducts && coupon.specificProducts.length > 0) {
      if (!cartProductIds || cartProductIds.length === 0) {
        return NextResponse.json(
          { error: "This coupon is not applicable for your current cart", valid: false },
          { status: 400 }
        );
      }
      
      // Check if any cart product is in the specific products list
      const hasEligibleProduct = cartProductIds.some(productId => 
        coupon.specificProducts.includes(productId)
      );
      
      if (!hasEligibleProduct) {
        return NextResponse.json(
          { error: "This coupon is not applicable for the products in your cart", valid: false },
          { status: 400 }
        );
      }
    }

    // Check max uses
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json(
        { error: "Coupon usage limit reached", valid: false },
        { status: 400 }
      );
    }

    // Check per-user usage limit
    if (userId && coupon.maxUsesPerUser) {
      const userUsageCount = await Order.countDocuments({
        userId,
        "coupon.code": code.toUpperCase(),
      });

      if (userUsageCount >= coupon.maxUsesPerUser) {
        return NextResponse.json(
          { error: "You have already used this coupon", valid: false },
          { status: 400 }
        );
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = (orderTotal * (coupon.discountValue || coupon.discount || 0)) / 100;
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }
    } else if (coupon.discountType === "fixed") {
      discountAmount = coupon.discountValue || coupon.discount || 0;
    }

    discountAmount = Number(discountAmount.toFixed(2));

    return NextResponse.json({
      success: true,
      valid: true,
      coupon: {
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue || coupon.discount,
        discountAmount,
        freeShipping: Boolean(coupon.freeShipping),
      },
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    return NextResponse.json(
      { error: "Failed to validate coupon" },
      { status: 500 }
    );
  }
}
