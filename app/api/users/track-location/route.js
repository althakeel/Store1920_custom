import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { getAuth } from "@/lib/firebase-admin";

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const data = await request.json();

    await connectDB();

    let userId = null;

    // If user is authenticated, get their ID
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await getAuth().verifyIdToken(idToken);
        userId = decodedToken.uid;
      } catch (error) {
        // User not authenticated, proceed with guest tracking
      }
    }

    const rawForwardedIp = request.headers.get("x-forwarded-for");
    const rawRealIp = request.headers.get("x-real-ip");
    const rawCfIp = request.headers.get("cf-connecting-ip");
    const rawIp = rawCfIp || rawForwardedIp || rawRealIp || "";
    const clientIp = rawIp.split(",")[0].trim().replace(/^\[|\]$/g, "").split(":")[0];
    const isLocalIp = !clientIp || clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "localhost";

    // Fetch geolocation data from IP
    let locationData = {
      city: "Unknown",
      state: "Unknown",
      country: "Unknown",
      latitude: null,
      longitude: null,
    };

    try {
      const ipLookupUrl = isLocalIp
        ? "https://ipapi.co/json/"
        : `http://ip-api.com/json/${clientIp}?fields=status,city,regionName,country,lat,lon,query`;

      const ipResponse = await fetch(ipLookupUrl, {
        headers: { "User-Agent": "Store1920-LocationTracker" }
      });

      if (ipResponse.ok) {
        const geoData = await ipResponse.json();

        if (!isLocalIp && geoData.status === "success") {
          locationData = {
            city: geoData.city || "Unknown",
            state: geoData.regionName || "Unknown",
            country: geoData.country || "Unknown",
            latitude: geoData.lat ?? null,
            longitude: geoData.lon ?? null,
          };
        } else if (isLocalIp) {
          locationData = {
            city: geoData.city || "Unknown",
            state: geoData.region || "Unknown",
            country: geoData.country_name || "Unknown",
            latitude: geoData.latitude ?? null,
            longitude: geoData.longitude ?? null,
          };
        }
      }
    } catch (geoError) {
      console.log("Geolocation fetch error:", geoError.message);
    }

    // Browser and device detection
    const userAgent = request.headers.get("user-agent") || "";
    const deviceType = /mobile|android|iphone|ipad/i.test(userAgent)
      ? "Mobile"
      : "Desktop";
    const browser = getBrowserInfo(userAgent);

    const trackingData = {
      timestamp: new Date(),
      ip: isLocalIp ? "Unknown" : clientIp,
      city: locationData.city,
      state: locationData.state,
      country: locationData.country,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      deviceType,
      browser,
      userAgent: userAgent.substring(0, 200),
      pageUrl: data.pageUrl || "/",
    };

    // If user is authenticated, save to their profile
    if (userId) {
      let user = await User.findById(userId);

      if (!user) {
        user = await User.create({
          _id: userId,
          locations: [trackingData],
          lastLocation: {
            city: locationData.city,
            state: locationData.state,
            country: locationData.country,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            timestamp: new Date(),
          },
          firstVisitLocation: {
            city: locationData.city,
            state: locationData.state,
            country: locationData.country,
            timestamp: new Date(),
          },
        });
      } else {
        // Update existing user
        if (!user.locations) user.locations = [];
        user.locations.push(trackingData);

        // Keep only last 100 location records
        if (user.locations.length > 100) {
          user.locations = user.locations.slice(-100);
        }

        user.lastLocation = {
          city: locationData.city,
          state: locationData.state,
          country: locationData.country,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          timestamp: new Date(),
        };

        await user.save();
      }
    }

    return NextResponse.json({
      success: true,
      message: "Location tracked successfully",
      location: trackingData,
      userId: userId || null,
    });
  } catch (error) {
    console.error("Location tracking error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}

function getBrowserInfo(userAgent) {
  if (/Chrome/.test(userAgent)) return "Chrome";
  if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) return "Safari";
  if (/Firefox/.test(userAgent)) return "Firefox";
  if (/Edge|Edg/.test(userAgent)) return "Edge";
  if (/Opera/.test(userAgent)) return "Opera";
  return "Other";
}
