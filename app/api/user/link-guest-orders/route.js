import connectDB from '@/lib/mongodb';
import { NextResponse } from "next/server";
import { getAuth } from '@/lib/firebase-admin';
import { linkGuestOrdersToUser, resolveContactForGuestLinking } from '@/lib/linkGuestOrders';

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

        const body = await request.json().catch(() => ({}));
        const { email, phone, phones } = await resolveContactForGuestLinking({
            decodedToken,
            body,
            userId,
        });

        if (!email && !phone && !(phones || []).length) {
            return NextResponse.json({ error: "Email or phone required" }, { status: 400 });
        }

        const result = await linkGuestOrdersToUser(userId, { email, phone, phones });

        if (!result.linked) {
            return NextResponse.json({ 
                message: "No guest orders found",
                linked: false 
            });
        }

        return NextResponse.json({ 
            message: `Successfully linked ${result.count} guest order(s) to your account`,
            linked: true,
            count: result.count
        });

    } catch (error) {
        console.error("Error linking guest orders:", error);
        return NextResponse.json({ 
            error: error.message || "Failed to link guest orders" 
        }, { status: 500 });
    }
}
