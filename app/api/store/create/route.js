import { NextResponse } from "next/server";
import imagekit from "@/configs/imageKit";
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Store from '@/models/Store';

// Ensure Node.js runtime so Buffer and ImageKit work (avoids Edge runtime errors)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


const json = (body, status = 200) => NextResponse.json(body, { status });

const decodeJwtPayload = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
};

const getDevDecodedToken = (idToken) => {
  const payload = decodeJwtPayload(idToken);
  if (!payload?.sub) return null;
  return {
    uid: payload.sub,
    email: payload.email || '',
    name: payload.name || payload.email || 'Unknown',
    picture: payload.picture || '',
    aud: payload.aud || '',
  };
};


export async function POST(request) {
  try {
    await connectDB();
    
    // Firebase Auth: Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const idToken = authHeader.split('Bearer ')[1];
    let adminProjectId = '';
    
    const { getAuth } = await import('firebase-admin/auth');
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    
    if (getApps().length === 0) {
      try {
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountKey) {
          console.error('[DEBUG] FIREBASE_SERVICE_ACCOUNT_KEY not found in environment');
          return json({ error: 'Firebase configuration missing' }, 500);
        }
        const serviceAccount = JSON.parse(serviceAccountKey);
        adminProjectId = serviceAccount.project_id || '';
        
        initializeApp({
          credential: cert(serviceAccount)
        });
        console.log('[DEBUG] Firebase Admin initialized successfully');
      } catch (initError) {
        console.error('[DEBUG] Firebase initialization error:', initError);
        return json({ error: 'Firebase initialization failed', details: initError.message }, 500);
      }
    } else {
      try {
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (serviceAccountKey) {
          const serviceAccount = JSON.parse(serviceAccountKey);
          adminProjectId = serviceAccount.project_id || '';
        }
      } catch (err) {
        console.warn('Could not extract Firebase project ID:', err.message);
        adminProjectId = '';
      }
    }
    
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      const payload = decodeJwtPayload(idToken);
      const tokenProjectId = payload?.aud || '';
      if (adminProjectId && tokenProjectId && adminProjectId !== tokenProjectId) {
        if (process.env.NODE_ENV !== 'production') {
          const devToken = getDevDecodedToken(idToken);
          if (devToken) {
            decodedToken = devToken;
          } else {
            return json(
              {
                error: 'Firebase server configuration mismatch',
                details: 'FIREBASE_SERVICE_ACCOUNT_KEY project_id does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID',
                tokenProjectId,
                adminProjectId,
              },
              500
            );
          }
        } else {
        return json(
          {
              error: 'Firebase server configuration mismatch',
              details: 'FIREBASE_SERVICE_ACCOUNT_KEY project_id does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID',
            tokenProjectId,
            adminProjectId,
          },
            500
        );
        }
      }
      if (!decodedToken) {
        console.error('[DEBUG] Token verification error:', e);
        return json({ error: 'Invalid token', details: e.message }, 401);
      }
    }
    const userId = decodedToken.uid;
    const userEmail = decodedToken.email || '';
    const userName = decodedToken.name || 'Unknown';
    const userImage = decodedToken.picture || '';

    // Ensure user exists in database
    await User.findOneAndUpdate(
      { _id: userId },
      {
        $setOnInsert: {
          _id: userId,
          name: userName,
          email: userEmail,
          image: userImage,
        }
      },
      { upsert: true, new: true }
    );

    const formData = await request.formData();

    const getField = (key) => {
      const value = formData.get(key);
      return value ? String(value).trim() : "";
    };

    const name = getField("name");
    const username = getField("username").toLowerCase();
    const description = getField("description");
    const email = getField("email");
    const contact = getField("contact");
    const address = getField("address");
    const image = formData.get("image");

    // Check for missing fields
    const missing = [];
    if (!name) missing.push("name");
    if (!username) missing.push("username");
    if (!description) missing.push("description");
    if (!email) missing.push("email");
    if (!contact) missing.push("contact");
    if (!address) missing.push("address");
    if (!image) missing.push("image");

    if (missing.length) return json({ error: "Missing fields", missing }, 400);

    // Check if user already has a store
    const existingStore = await Store.findOne({ userId }).lean();
    if (existingStore) return json({ status: existingStore.status }, 200);

    // Check if username is already taken
    const usernameTaken = await Store.findOne({ username }).lean();
    if (usernameTaken) return json({ error: "Username already taken" }, 400);

    // Upload image to ImageKit
    const buffer = Buffer.from(await image.arrayBuffer());
    const response = await imagekit.upload({
      file: buffer,
      fileName: image.name || `${username}-logo`,
      folder: "logos",
    });

    const optimizedImage = imagekit.url({
      path: response.filePath,
      transformation: [
        { quality: "auto" },
        { format: "webp" },
        { width: "512" },
      ],
    });

    // Create the store
    const newStore = await Store.create({
      userId,
      name,
      username,
      description,
      email,
      contact,
      address,
      logo: optimizedImage,
      status: 'pending',
      isActive: false,
    });
    console.log('Store created:', {
      id: newStore._id.toString(),
      status: newStore.status,
      isActive: newStore.isActive,
      createdAt: newStore.createdAt,
    });

    // Send emails (auto-reply and welcome)
    try {
      const { sendAutoReplyEmail, sendWelcomeEmail } = await import('@/lib/emailjs');
      await sendAutoReplyEmail({ to: email, name });
      await sendWelcomeEmail({ to: email, name });
      console.log('Auto-reply and welcome emails sent to', email);
    } catch (err) {
      console.error('Failed to send emails:', err.message);
    }

    return json({ message: "Store created, waiting for approval", storeId: newStore._id.toString() }, 201);
  } catch (error) {
    console.error(error);
    return json({ error: error?.code || error?.message || "Unknown error" }, 500);
  }
}


// GET: Check if the user has already registered a store
export async function GET(request) {
  try {
    await connectDB();
    
    // Firebase Auth: Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const idToken = authHeader.split('Bearer ')[1];
    let adminProjectId = '';
    
    const { getAuth } = await import('firebase-admin/auth');
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    
    if (getApps().length === 0) {
      try {
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountKey) {
          return json({ error: 'Firebase configuration missing' }, 500);
        }
        const serviceAccount = JSON.parse(serviceAccountKey);
        adminProjectId = serviceAccount.project_id || '';
        initializeApp({
          credential: cert(serviceAccount)
        });
      } catch (initError) {
        console.error('[DEBUG] Firebase initialization error:', initError);
        return json({ error: 'Firebase initialization failed' }, 500);
      }
    } else {
      try {
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (serviceAccountKey) {
          const serviceAccount = JSON.parse(serviceAccountKey);
          adminProjectId = serviceAccount.project_id || '';
        }
      } catch (err) {
        console.warn('Could not extract Firebase project ID:', err.message);
        adminProjectId = '';
      }
    }
    
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      const payload = decodeJwtPayload(idToken);
      const tokenProjectId = payload?.aud || '';
      if (adminProjectId && tokenProjectId && adminProjectId !== tokenProjectId) {
        if (process.env.NODE_ENV !== 'production') {
          const devToken = getDevDecodedToken(idToken);
          if (devToken) {
            decodedToken = devToken;
          } else {
            return json(
              {
                error: 'Firebase server configuration mismatch',
                details: 'FIREBASE_SERVICE_ACCOUNT_KEY project_id does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID',
                tokenProjectId,
                adminProjectId,
              },
              500
            );
          }
        } else {
        return json(
          {
              error: 'Firebase server configuration mismatch',
              details: 'FIREBASE_SERVICE_ACCOUNT_KEY project_id does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID',
            tokenProjectId,
            adminProjectId,
          },
            500
        );
        }
      }
      if (!decodedToken) {
        console.error('[DEBUG] Token verification error:', e);
        return json({ error: 'Invalid token', details: e.message }, 401);
      }
    }
    const userId = decodedToken.uid;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const store = await Store.findOne({ userId }).lean();
    if (store) return json({ status: store.status }, 200);

    return json({ status: "not registered" }, 200);
  } catch (error) {
    console.error(error);
    return json({ error: error?.code || error?.message || "Unknown error" }, 500);
  }
}
