import dbConnect from "@/lib/mongodb";
import Store from "@/models/Store";
import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/firebase-admin";

export async function GET(request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('[is-seller API] Missing or invalid authorization header:', authHeader);
            return NextResponse.json({ isSeller: false, reason: 'missing-auth-header' }, { status: 200 });
        }
        const idToken = authHeader.split(' ')[1];
        let decodedToken;
        try {
            // Set GCLOUD_PROJECT env var before verifying token to fix Project ID detection
            if (!process.env.GCLOUD_PROJECT && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                process.env.GCLOUD_PROJECT = serviceAccount.project_id;
                process.env.GOOGLE_CLOUD_PROJECT = serviceAccount.project_id;
            }
            decodedToken = await getAuth().verifyIdToken(idToken);
        } catch (err) {
            console.log('[is-seller API] Token verification error:', err.message);
            console.log('[is-seller API] Token (first 20 chars):', idToken?.substring(0, 20));
            return NextResponse.json({ isSeller: false, reason: 'invalid-token', error: err.message }, { status: 200 });
        }
        const userId = decodedToken.uid;
        console.log('[is-seller API] Checking seller status for userId:', userId);

        try {
            await dbConnect();
        } catch (dbError) {
            console.error('[is-seller API] Database unavailable:', dbError);
            return NextResponse.json(
                {
                    isSeller: false,
                    reason: 'database-unavailable',
                    message: dbError?.message || 'Failed to connect to database',
                },
                { status: 503 }
            );
        }

        const sellerResult = await authSeller(userId);
        console.log('[is-seller API] authSeller result:', sellerResult);
        if(!sellerResult){
            // Not a seller or not approved
            console.log('[is-seller API] User is NOT a seller (authSeller returned false)');
            return NextResponse.json({ isSeller: false, userId, reason: 'not-seller-or-not-approved' }, { status: 200 });
        }
        console.log('[is-seller API] User IS a seller, fetching store info...');
        const storeInfo = await Store.findById(sellerResult).lean();
        console.log('[is-seller API] Store info:', storeInfo ? 'Found' : 'Not found');
        return NextResponse.json({ isSeller: true, storeInfo, userId });
    } catch (error) {
        console.error('[is-seller API] Error:', error);
        return NextResponse.json({ isSeller: false, reason: 'server-error', message: error.code || error.message }, { status: 200 });
    }
}