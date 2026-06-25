import dbConnect from "@/lib/mongodb";
import Coupon from "@/models/Coupon";
import Order from "@/models/Order";
import SpinLog from "@/models/SpinLog";
import { getAuth } from "@/lib/firebase-admin";
import { getCouponAccessErrorAsync } from "@/lib/couponAccess";
import { NextResponse } from "next/server";

async function getUserOrderCount(userId, storeId = null) {
    const filter = storeId ? { userId, storeId } : { userId };
    return Order.countDocuments(filter);
}

async function hasUsedCoupon(userId, couponCode) {
    return Order.exists({
        userId,
        isCouponUsed: true,
        'coupon.code': couponCode,
    });
}

// Verify coupon
export async function POST(request) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const idToken = authHeader.split(" ")[1];
        let decodedToken;
        try {
            decodedToken = await getAuth().verifyIdToken(idToken);
        } catch {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = decodedToken.uid;

        await dbConnect();
        const { code, cartTotal, productIds, storeId } = await request.json();

        const coupon = await Coupon.findOne({
            code: code.toUpperCase(),
            expiresAt: { $gt: new Date() },
            isActive: true,
        }).lean();

        if (!coupon) {
            return NextResponse.json({ error: "Coupon not found or expired" }, { status: 404 });
        }

        const accessError = await getCouponAccessErrorAsync(coupon, userId, SpinLog);
        if (accessError) {
            return NextResponse.json({ error: accessError }, { status: 403 });
        }

        if (coupon.storeId && storeId && coupon.storeId !== storeId) {
            return NextResponse.json({ error: "This coupon is not valid for this store" }, { status: 400 });
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
        }

        if (coupon.forNewUser) {
            const orderCount = await getUserOrderCount(userId);
            if (orderCount > 0) {
                return NextResponse.json({ error: "Coupon valid for new users only" }, { status: 400 });
            }
        }

        if (coupon.firstOrderOnly) {
            const orderCount = await getUserOrderCount(userId, coupon.storeId || storeId || null);
            if (orderCount > 0) {
                return NextResponse.json({ error: "Coupon valid for first order only" }, { status: 400 });
            }
        }

        if (coupon.oneTimePerUser) {
            const alreadyUsed = await hasUsedCoupon(userId, coupon.code);
            if (alreadyUsed) {
                return NextResponse.json({ error: "You have already used this coupon" }, { status: 400 });
            }
        }

        if (coupon.forMember) {
            const hasPlusPlan = false;
            if (!hasPlusPlan) {
                return NextResponse.json({ error: "Coupon valid for members only" }, { status: 400 });
            }
        }

        if (cartTotal && coupon.minPrice > 0 && cartTotal < coupon.minPrice) {
            return NextResponse.json({
                error: `Minimum cart value of AED${coupon.minPrice} required`,
            }, { status: 400 });
        }

        if (productIds && coupon.minProductCount && productIds.length < coupon.minProductCount) {
            return NextResponse.json({
                error: `Minimum ${coupon.minProductCount} products required`,
            }, { status: 400 });
        }

        if (coupon.specificProducts && coupon.specificProducts.length > 0 && productIds) {
            const hasValidProduct = productIds.some((id) => coupon.specificProducts.includes(id));
            if (!hasValidProduct) {
                return NextResponse.json({
                    error: "This coupon is not valid for the products in your cart",
                }, { status: 400 });
            }
        }

        return NextResponse.json({ coupon });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}
