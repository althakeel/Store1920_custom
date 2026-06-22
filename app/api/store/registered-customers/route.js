import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Store from "@/models/Store";
import { getAuth } from "@/lib/firebase-admin";

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Verify user is a store owner
    await connectDB();
    const store = await Store.findOne({ userId: userId });
    if (!store) {
      return NextResponse.json(
        { error: "Store not found" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";

    // Calculate date range
    const now = new Date();
    let startDate = new Date(0); // All time

    if (filter === "today") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === "week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (filter === "month") {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    }

    // Fetch registered customers (users with email)
    const query = filter === "all" 
      ? { email: { $exists: true, $ne: null } }
      : { 
          email: { $exists: true, $ne: null },
          createdAt: { $gte: startDate }
        };

    const customers = await User.find(query)
      .select('email name createdAt firstVisitLocation lastLocation')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const weekStart = new Date();
    weekStart.setDate(now.getDate() - 7);
    
    const monthStart = new Date();
    monthStart.setMonth(now.getMonth() - 1);

    const emailFilter = { email: { $exists: true, $ne: null } };

    const [total, today, thisWeek, thisMonth] = await Promise.all([
      User.countDocuments(emailFilter),
      User.countDocuments({ ...emailFilter, createdAt: { $gte: todayStart } }),
      User.countDocuments({ ...emailFilter, createdAt: { $gte: weekStart } }),
      User.countDocuments({ ...emailFilter, createdAt: { $gte: monthStart } }),
    ]);

    const stats = {
      total,
      today,
      thisWeek,
      thisMonth,
    };

    const formattedCustomers = customers.map(customer => ({
      email: customer.email,
      name: customer.name,
      createdAt: customer.createdAt,
      firstVisitLocation: customer.firstVisitLocation,
      lastLocation: customer.lastLocation,
      totalVisits: 0,
    }));

    return NextResponse.json({
      customers: formattedCustomers,
      stats,
      filter,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("Registered customers error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
