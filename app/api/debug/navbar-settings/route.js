import dbConnect from '@/lib/mongodb';
import NavbarMenuSettings from '@/models/NavbarMenuSettings';
import { getAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

export async function GET(req) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);
    
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    console.log('[DEBUG] Current User ID:', userId);

    // Get ALL navbar settings for this user
    const allSettings = await NavbarMenuSettings.find({ storeId: userId }).lean();
    
    console.log('[DEBUG] Total documents found:', allSettings.length);
    
    if (allSettings.length === 0) {
      return NextResponse.json({
        status: 'NO_DOCUMENTS',
        userId,
        message: 'No navbar settings found in database for this user',
        allDocs: []
      });
    }

    return NextResponse.json({
      status: 'FOUND',
      userId,
      totalDocs: allSettings.length,
      allDocs: allSettings.map(doc => ({
        _id: doc._id.toString(),
        storeId: doc.storeId,
        enabled: doc.enabled,
        logoUrl: doc.logoUrl || '(EMPTY)',
        logoWidth: doc.logoWidth,
        logoHeight: doc.logoHeight,
        backgroundColor: doc.backgroundColor,
        itemsCount: doc.items?.length || 0,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      }))
    });
  } catch (error) {
    console.error('[DEBUG] Error:', error);
    return NextResponse.json({
      status: 'ERROR',
      message: error.message
    }, { status: 500 });
  }
}
