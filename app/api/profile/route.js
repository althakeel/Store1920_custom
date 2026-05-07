import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { getAuth } from "@/lib/firebase-admin";

async function getUserIdFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const idToken = authHeader.split(" ")[1];
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return decoded?.uid || null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const uid = await getUserIdFromRequest(request);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findOne({ _id: uid }).lean();

    return NextResponse.json({
      profile: {
        name: user?.name || "",
        email: user?.email || "",
        phone: user?.phone || "",
        image: user?.image || "",
        referralCode: user?.referralCode || "",
        referredByUserId: user?.referredByUserId || null,
        referralRewardCreditedAt: user?.referralRewardCreditedAt || null,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to fetch profile" }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const uid = await getUserIdFromRequest(request);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = (body?.name || "").toString().trim();
    const phone = (body?.phone || "").toString().trim();
    const image = (body?.image || "").toString().trim();
    const email = (body?.email || "").toString().trim().toLowerCase();

    await dbConnect();

    const update = {
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(image !== undefined ? { image } : {}),
      ...(email ? { email } : {}),
    };

    const user = await User.findOneAndUpdate(
      { _id: uid },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      profile: {
        name: user?.name || "",
        email: user?.email || "",
        phone: user?.phone || "",
        image: user?.image || "",
        referralCode: user?.referralCode || "",
        referredByUserId: user?.referredByUserId || null,
        referralRewardCreditedAt: user?.referralRewardCreditedAt || null,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to update profile" }, { status: 400 });
  }
}
