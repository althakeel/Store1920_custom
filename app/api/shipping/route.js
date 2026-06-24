import dbConnect from "@/lib/mongodb";
import ShippingSetting from "@/models/ShippingSetting";
import authSeller from "@/middlewares/authSeller";
import {
  resolveShippingOptions,
  sanitizeShippingOptionsPayload,
  syncLegacyFieldsFromOptions,
} from "@/lib/shippingOptions";

import { NextResponse } from "next/server";

// GET: Public - return shipping settings for a specific store
// Pass ?storeId=xxx in query params
export async function GET(request) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    
    console.log('=== SHIPPING API GET ===');
    console.log('Requested storeId:', storeId);
    
    let setting;
    if (storeId) {
      setting = await ShippingSetting.findOne({ storeId }).lean();
    } else {
      // Fallback: get the first store's settings (for backward compatibility)
      setting = await ShippingSetting.findOne({}).lean();
    }
    
    console.log('Retrieved setting - maxCODAmount:', setting?.maxCODAmount, 'codFee:', setting?.codFee);
    console.log('Full setting:', JSON.stringify(setting));

    const normalizedSetting = setting
      ? { ...setting, shippingOptions: resolveShippingOptions(setting) }
      : null;
    
    return NextResponse.json({
      setting: normalizedSetting || {
        enabled: false,
        shippingType: "FLAT_RATE",
        flatRate: 0,
        perItemFee: 0,
        maxItemFee: null,
        weightUnit: "kg",
        baseWeight: 1,
        baseWeightFee: 0,
        additionalWeightFee: 0,
        freeShippingMin: 0,
        enableProductSpecificFreeShipping: false,
        productSpecificFreeShippingMode: "ORDER_LEVEL",
        localDeliveryFee: null,
        regionalDeliveryFee: null,
        estimatedDays: "2-5",
        enableCOD: true,
        codFee: 0,
        maxCODAmount: 0,
        enableExpressShipping: false,
        expressShippingFee: 0,
        expressEstimatedDays: "1-2",
        stateCharges: [],
        shippingOptions: resolveShippingOptions(null),
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

// PUT: Seller only - update or create singleton settings
export async function PUT(request) {
  try {
    // Extract userId from Firebase token in Authorization header
    const authHeader = request.headers.get("authorization");
    let userId = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.split(" ")[1];
      const { getAuth } = await import("firebase-admin/auth");
      const { initializeApp, applicationDefault, getApps } = await import("firebase-admin/app");
      if (getApps().length === 0) {
        initializeApp({ credential: applicationDefault() });
      }
      try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        userId = decodedToken.uid;
      } catch (e) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const storeId = await authSeller(userId);
    if (!storeId) return NextResponse.json({ error: "not authorized" }, { status: 401 });

    const body = await request.json();
    const shippingOptions = sanitizeShippingOptionsPayload(body.shippingOptions);
    const legacyFromOptions = syncLegacyFieldsFromOptions(shippingOptions);
    
    console.log('=== SHIPPING API PUT ===');
    console.log('Received body.maxCODAmount:', body.maxCODAmount, 'Type:', typeof body.maxCODAmount);
    console.log('Received body.codFee:', body.codFee, 'Type:', typeof body.codFee);
    console.log('Received body.enableCOD:', body.enableCOD);
    
    const data = {
      storeId,  // Associate settings with the seller's store
      enabled: Boolean(body.enabled ?? true),
      shippingType: legacyFromOptions.shippingType || body.shippingType || "FLAT_RATE",
      // Flat Rate
      flatRate: Number(legacyFromOptions.flatRate ?? body.flatRate ?? 5),
      // Per Item
      perItemFee: Number(legacyFromOptions.perItemFee ?? body.perItemFee ?? 2),
      maxItemFee: (legacyFromOptions.maxItemFee ?? body.maxItemFee)
        ? Number(legacyFromOptions.maxItemFee ?? body.maxItemFee)
        : null,
      // Weight Based
      weightUnit: legacyFromOptions.weightUnit || body.weightUnit || "kg",
      baseWeight: Number(legacyFromOptions.baseWeight ?? body.baseWeight ?? 1),
      baseWeightFee: Number(legacyFromOptions.baseWeightFee ?? body.baseWeightFee ?? 5),
      additionalWeightFee: Number(legacyFromOptions.additionalWeightFee ?? body.additionalWeightFee ?? 2),
      // Free Shipping
      freeShippingMin: Number(body.freeShippingMin ?? 499),
      enableProductSpecificFreeShipping: Boolean(body.enableProductSpecificFreeShipping ?? false),
      productSpecificFreeShippingMode:
        body.productSpecificFreeShippingMode === 'MARKED_ITEMS_ONLY'
          ? 'MARKED_ITEMS_ONLY'
          : 'ORDER_LEVEL',
      // Regional
      localDeliveryFee: body.localDeliveryFee ? Number(body.localDeliveryFee) : null,
      regionalDeliveryFee: body.regionalDeliveryFee ? Number(body.regionalDeliveryFee) : null,
      // Delivery Time
      estimatedDays: legacyFromOptions.estimatedDays || body.estimatedDays || "2-5",
      // COD
      enableCOD: Boolean(body.enableCOD ?? true),
      codFee: Number(body.codFee ?? 0),
      maxCODAmount: Number(body.maxCODAmount ?? 0),
      // Express (legacy sync from options)
      enableExpressShipping: Boolean(
        legacyFromOptions.enableExpressShipping ?? body.enableExpressShipping ?? false,
      ),
      expressShippingFee: Number(
        legacyFromOptions.expressShippingFee ?? body.expressShippingFee ?? 20,
      ),
      expressEstimatedDays:
        legacyFromOptions.expressEstimatedDays || body.expressEstimatedDays || "1-2",
      stateCharges: Array.isArray(body.stateCharges)
        ? body.stateCharges
            .map((entry) => ({
              state: String(entry?.state || '').trim(),
              fee: Number(entry?.fee || 0)
            }))
            .filter((entry) => entry.state)
        : [],
      shippingOptions,
    };
    
    console.log('Data to save - maxCODAmount:', data.maxCODAmount, 'codFee:', data.codFee);

    await dbConnect();
    const setting = await ShippingSetting.findOneAndUpdate(
      { storeId },  // Find by storeId (one setting per store)
      data,
      { upsert: true, new: true }
    );
    console.log('Saved setting - maxCODAmount:', setting.maxCODAmount, 'codFee:', setting.codFee);
    return NextResponse.json({ setting });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
