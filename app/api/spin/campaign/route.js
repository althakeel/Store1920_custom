import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import SpinCampaign from "@/models/SpinCampaign";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = String(searchParams.get("storeId") || "").trim();

    await connectDB();

    // If storeId provided, look up that specific store's campaign.
    // Otherwise choose the latest enabled campaign that has at least one slice.
    const query = storeId
      ? { storeId }
      : { isEnabled: true, 'slices.0': { $exists: true } };

    const campaign = await SpinCampaign.findOne(query).sort({ updatedAt: -1, _id: -1 }).lean();

    if (!campaign || !campaign.isEnabled || !Array.isArray(campaign.slices) || campaign.slices.length === 0) {
      return NextResponse.json({
        isEnabled: false,
        campaign: null,
        lastUpdatedAt: null,
      });
    }

    return NextResponse.json({
      isEnabled: true,
      campaign: {
        storeId: campaign.storeId,
        campaignName: campaign.campaignName,
        dailySpinLimit: campaign.dailySpinLimit,
        couponPrefix: campaign.couponPrefix,
        homePageOnly: Boolean(campaign.homePageOnly),
        showAfterSeconds: Number(campaign.showAfterSeconds || 0),
        slices: campaign.slices,
      },
      lastUpdatedAt: campaign.updatedAt,
    });
  } catch (error) {
    console.error("Failed to fetch spin campaign:", error);
    return NextResponse.json({ error: "Failed to fetch spin campaign" }, { status: 500 });
  }
}
