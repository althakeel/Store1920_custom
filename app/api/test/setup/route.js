import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Store from "@/models/Store";
import Coupon from "@/models/Coupon";

/**
 * DEVELOPMENT ONLY - Complete setup: Create store + coupons
 */
export async function POST(request) {
  try {
    await connectDB();

    // Check if store exists
    let store = await Store.findOne();
    
    if (!store) {
      console.log('Creating default store...');
      store = await Store.create({
        name: "Store1920 Store",
        userId: "default-admin",
        username: "Store1920",
        description: "Your online marketplace",
        email: "admin@Store1920.com",
        isActive: true,
        status: "approved",
      });
      console.log('Store created:', store._id);
    } else {
      console.log('Store already exists:', store._id);
    }

    const storeId = store._id.toString();

    // Check if coupons exist
    const existingCoupons = await Coupon.find({ storeId }).countDocuments();
    
    let createdCoupons = [];
    if (existingCoupons === 0) {
      console.log('Creating sample coupons...');
      
      const sampleCoupons = [
        {
          code: "WELCOME10",
          title: "Welcome 10% Off",
          description: "Get 10% off on your first order",
          storeId,
          discountType: "percentage",
          discountValue: 10,
          minOrderValue: 500,
          maxDiscount: 500,
          maxUses: 100,
          isActive: true,
          badgeColor: "green",
        },
        {
          code: "SAVE50",
          title: "Save AED50",
          description: "Flat AED50 off on orders above AED1000",
          storeId,
          discountType: "fixed",
          discountValue: 50,
          minOrderValue: 1000,
          maxUses: 50,
          isActive: true,
          badgeColor: "orange",
        },
        {
          code: "MEGA20",
          title: "Mega 20% Discount",
          description: "20% off on all products",
          storeId,
          discountType: "percentage",
          discountValue: 20,
          minOrderValue: 0,
          maxDiscount: 1000,
          maxUses: 200,
          isActive: true,
          badgeColor: "blue",
        },
      ];

      createdCoupons = await Coupon.insertMany(sampleCoupons);
      console.log('Created', createdCoupons.length, 'coupons');
    } else {
      console.log('Coupons already exist:', existingCoupons);
      createdCoupons = await Coupon.find({ storeId }).limit(10);
    }

    return NextResponse.json({
      success: true,
      message: "Setup complete! Store and coupons ready.",
      store: {
        id: store._id.toString(),
        name: store.name,
        username: store.username,
      },
      coupons: {
        total: createdCoupons.length,
        codes: createdCoupons.map(c => c.code),
      },
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// GET - Check current setup status
export async function GET(request) {
  try {
    await connectDB();

    const store = await Store.findOne();
    const couponCount = store ? await Coupon.countDocuments({ storeId: store._id.toString() }) : 0;

    return NextResponse.json({
      storeExists: !!store,
      storeId: store?._id?.toString(),
      storeName: store?.name,
      couponCount,
      setupComplete: !!store && couponCount > 0,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
