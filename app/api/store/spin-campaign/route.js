import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getAuth } from "@/lib/firebase-admin";
import Store from "@/models/Store";
import SpinCampaign from "@/models/SpinCampaign";

const allowedRewardTypes = new Set(["coupon_percent", "coupon_flat", "free_shipping", "no_win"]);

function sanitizeSlices(input) {
  if (!Array.isArray(input)) return [];

  return input
    .map((slice) => {
      const rewardType = String(slice?.rewardType || "").trim();
      const weight = Number(slice?.weight || 0);
      const label = String(slice?.label || "").trim();

      if (!label || !allowedRewardTypes.has(rewardType) || weight <= 0) {
        return null;
      }

      return {
        label,
        weight,
        rewardType,
        discountValue: Math.max(0, Number(slice?.discountValue || 0)),
        minOrderValue: Math.max(0, Number(slice?.minOrderValue || 0)),
        expiryHours: Math.min(720, Math.max(1, Number(slice?.expiryHours || 48))),
        color: String(slice?.color || "#6366f1").trim(),
      };
    })
    .filter(Boolean);
}

async function getSellerStoreId(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }

  const idToken = authHeader.split(" ")[1];
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch (error) {
    return { error: "Unauthorized", status: 401 };
  }

  const store = await Store.findOne({ userId: decoded.uid }).lean();
  if (!store?._id) {
    return { error: "Store not found", status: 404 };
  }

  return { storeId: store._id.toString() };
}

export async function GET(request) {
  try {
    await connectDB();
    const seller = await getSellerStoreId(request);
    if (seller.error) {
      return NextResponse.json({ error: seller.error }, { status: seller.status });
    }

    const campaign = await SpinCampaign.findOne({ storeId: seller.storeId }).lean();

    return NextResponse.json({
      success: true,
      campaign: campaign || {
        storeId: seller.storeId,
        isEnabled: false,
        campaignName: "Spin & Win",
        couponPrefix: "SPIN",
        dailySpinLimit: 1,
        spinInterval: "daily",
        homePageOnly: false,
        showAfterSeconds: 0,
        slices: [
          {
            label: "10% Off",
            color: "#6366f1",
            weight: 30,
            rewardType: "coupon_percent",
            discountValue: 10,
            minOrderValue: 0,
            expiryHours: 48,
          },
          {
            label: "Free Shipping",
            color: "#22c55e",
            weight: 10,
            rewardType: "free_shipping",
            discountValue: 0,
            minOrderValue: 0,
            expiryHours: 48,
          },
          {
            label: "AED 50 Off",
            color: "#f59e0b",
            weight: 20,
            rewardType: "coupon_flat",
            discountValue: 50,
            minOrderValue: 300,
            expiryHours: 48,
          },
          {
            label: "Better Luck",
            color: "#94a3b8",
            weight: 40,
            rewardType: "no_win",
            discountValue: 0,
            minOrderValue: 0,
            expiryHours: 48,
          },
        ],
      },
    });
  } catch (error) {
    console.error("Failed to get spin campaign:", error);
    return NextResponse.json({ error: "Failed to fetch spin campaign" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const seller = await getSellerStoreId(request);
    if (seller.error) {
      return NextResponse.json({ error: seller.error }, { status: seller.status });
    }

    const body = await request.json();
    const slices = sanitizeSlices(body?.slices);

    if (body?.isEnabled && slices.length === 0) {
      return NextResponse.json(
        { error: "At least one valid slice is required to enable campaign" },
        { status: 400 }
      );
    }

    const campaign = await SpinCampaign.findOneAndUpdate(
      { storeId: seller.storeId },
      {
        $set: {
          storeId: seller.storeId,
          isEnabled: Boolean(body?.isEnabled),
          campaignName: String(body?.campaignName || "Spin & Win").trim() || "Spin & Win",
          couponPrefix: String(body?.couponPrefix || "SPIN").toUpperCase().replace(/[^A-Z0-9]/g, "") || "SPIN",
          dailySpinLimit: Math.min(10, Math.max(1, Number(body?.dailySpinLimit || 1))),
          spinInterval: ["daily", "weekly", "monthly", "unlimited"].includes(body?.spinInterval) ? body.spinInterval : "daily",
          homePageOnly: Boolean(body?.homePageOnly),
          showAfterSeconds: Math.min(300, Math.max(0, Number(body?.showAfterSeconds || 0))),
          slices,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    console.error("Failed to save spin campaign:", error);
    return NextResponse.json({ error: "Failed to save spin campaign" }, { status: 500 });
  }
}
