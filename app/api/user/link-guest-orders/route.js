import connectDB from '@/lib/mongodb';
import GuestUser from '@/models/GuestUser';
import Order from '@/models/Order';
import { NextResponse } from "next/server";
import { getAuth } from '@/lib/firebase-admin';
import { buildGuestOrderIdentityClauses, normalizeEmail } from '@/lib/orderIdentity';

function parseAuthHeader(request) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    return authHeader.split(' ')[1] || null;
}

// Link guest orders to newly created user account
export async function POST(request) {
    try {
        await connectDB();

        const idToken = parseAuthHeader(request);
        if (!idToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let decodedToken;
        try {
            decodedToken = await getAuth().verifyIdToken(idToken);
        } catch (err) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        
        if (!userId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 401 });
        }

    
        const user = await request.json();
        const email = normalizeEmail(user?.email || decodedToken.email);
        const phone = (user?.phone || decodedToken.phone_number || '').toString().trim();

        if (!email && !phone) {
            return NextResponse.json({ error: "Email or phone required" }, { status: 400 });
        }

        const orderFilter = buildGuestOrderIdentityClauses({ email, phone });
        if (orderFilter.length === 0) {
            return NextResponse.json({ 
                message: "No guest orders found",
                linked: false 
            });
        }

        const guestOrders = await Order.find({
            isGuest: true,
            $and: [
                { $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }] },
                { $or: orderFilter }
            ]
        }).select('_id').lean();

        if (guestOrders.length === 0) {
            return NextResponse.json({ 
                message: "No guest orders found",
                linked: false 
            });
        }

        await Order.updateMany({
            _id: {
                $in: guestOrders.map(order => order._id)
            }
        }, {
            $set: {
                userId,
                isGuest: false
            }
        });

        if (email || phone) {
            const guestUserFilter = [];
            if (email) guestUserFilter.push({ email });
            if (phone) guestUserFilter.push({ phone });

            if (guestUserFilter.length > 0) {
                await GuestUser.updateMany(
                    { $or: guestUserFilter },
                    {
                        accountCreated: true,
                        convertedUserId: userId,
                        convertedAt: new Date()
                    }
                ).catch(() => {});
            }
        }

        return NextResponse.json({ 
            message: `Successfully linked ${guestOrders.length} guest order(s) to your account`,
            linked: true,
            count: guestOrders.length
        });

    } catch (error) {
        console.error("Error linking guest orders:", error);
        return NextResponse.json({ 
            error: error.message || "Failed to link guest orders" 
        }, { status: 500 });
    }
}
