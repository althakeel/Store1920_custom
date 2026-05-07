import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getAuth } from "@/lib/firebase-admin";
import SpinCampaign from "@/models/SpinCampaign";
import SpinLog from "@/models/SpinLog";
import Coupon from "@/models/Coupon";

const rewardTypes = new Set(["coupon_percent", "coupon_flat", "free_shipping", "no_win"]);

function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function nextUtcMidnight(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

function pickWeightedSlice(slices = []) {
  const valid = slices.filter((slice) => Number(slice?.weight) > 0);
  const total = valid.reduce((sum, slice) => sum + Number(slice.weight), 0);
  if (total <= 0) return null;

  let r = Math.random() * total;
  for (const slice of valid) {
    r -= Number(slice.weight);
    if (r <= 0) return slice;
  }
  return valid[valid.length - 1] || null;
}

async function generateUniqueCouponCode(prefix, storeId) {
  const safePrefix = String(prefix || "SPIN").toUpperCase().replace(/[^A-Z0-9]/g, "") || "SPIN";

  for (let i = 0; i < 8; i += 1) {
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    const code = `${safePrefix}-${suffix}`;
    const exists = await Coupon.exists({ code, storeId });
    if (!exists) return code;
  }

  const fallback = `${safePrefix}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
  return fallback;
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing Firebase token" }, { status: 401 });
    }

    const idToken = authHeader.split(" ")[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json({ error: "Invalid Firebase token" }, { status: 401 });
    }

    const body = await request.json();
    const storeId = String(body?.storeId || "").trim();
    if (!storeId) {
      return NextResponse.json({ error: "storeId is required" }, { status: 400 });
    }

    await connectDB();

    const campaign = await SpinCampaign.findOne({ storeId }).lean();
    if (!campaign || !campaign.isEnabled || !Array.isArray(campaign.slices) || campaign.slices.length === 0) {
      return NextResponse.json({ error: "Spin wheel is not active for this store" }, { status: 404 });
    }

    const userId = decodedToken.uid;
    const today = utcDateKey();
    const usedSpins = await SpinLog.countDocuments({ userId, storeId, spinDate: today });

    if (usedSpins >= Number(campaign.dailySpinLimit || 1)) {
      return NextResponse.json(
        {
          error: "You have used all your spins for today. Come back tomorrow!",
          nextSpinAt: nextUtcMidnight().toISOString(),
        },
        { status: 429 }
      );
    }

    const winner = pickWeightedSlice(campaign.slices);
    if (!winner) {
      return NextResponse.json({ error: "Spin campaign has invalid slice weights" }, { status: 500 });
    }

    const rewardType = rewardTypes.has(winner.rewardType) ? winner.rewardType : "no_win";
    const expiryHours = Number(winner.expiryHours || 48);
    const expiresAt = new Date(Date.now() + Math.max(1, expiryHours) * 60 * 60 * 1000);

    let couponCode = null;
    let couponDoc = null;

    if (rewardType !== "no_win") {
      couponCode = await generateUniqueCouponCode(campaign.couponPrefix || "SPIN", storeId);
      const isPercent = rewardType === "coupon_percent";
      const isFreeShipping = rewardType === "free_shipping";
      const discountValue = Number(isFreeShipping ? 0 : winner.discountValue || 0);

      couponDoc = await Coupon.create({
        code: couponCode,
        title: winner.label,
        description: isFreeShipping
          ? "Free shipping reward from Spin & Win"
          : isPercent
          ? `${discountValue}% off reward from Spin & Win`
          : `AED ${discountValue} off reward from Spin & Win`,
        storeId,
        discountType: isPercent ? "percentage" : "fixed",
        discountValue,
        discount: discountValue,
        minOrderValue: Number(winner.minOrderValue || 0),
        minPrice: Number(winner.minOrderValue || 0),
        freeShipping: isFreeShipping,
        maxUses: 1,
        usageLimit: 1,
        maxUsesPerUser: 1,
        oneTimePerUser: true,
        expiresAt,
        isActive: true,
        isPublic: true,
        badgeColor: isFreeShipping ? "blue" : "green",
      });
    }

    await SpinLog.create({
      userId,
      storeId,
      spinDate: today,
      rewardType,
      couponCode,
      sliceLabel: winner.label,
    });

    const freeShipping = rewardType === "free_shipping";
    const discountValue = Number(rewardType === "no_win" || freeShipping ? 0 : winner.discountValue || 0);

    return NextResponse.json({
      sliceLabel: winner.label,
      rewardType,
      couponCode,
      discountValue,
      freeShipping,
      minOrderValue: Number(winner.minOrderValue || 0),
      expiresAt: couponDoc?.expiresAt || null,
      message:
        rewardType === "no_win"
          ? "Better luck next time! You can spin again tomorrow."
          : freeShipping
          ? `Congratulations! You won Free Shipping. Use code ${couponCode} at checkout.`
          : `Congratulations! You won: ${winner.label}. Use code ${couponCode} at checkout.`,
    });
  } catch (error) {
    console.error("Spin play error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
