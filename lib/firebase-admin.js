// lib/firebase-admin.js
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth as adminGetAuth } from 'firebase-admin/auth';

// Parse and validate service account
const keyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const expectedProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

let serviceAccount;
try {
  if (!keyEnv) {
    // During build time, Firebase may not be initialized yet
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_KEY env variable is missing - Firebase features will not be available at runtime');
  } else {
    serviceAccount = JSON.parse(keyEnv);

    // Validate required fields
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error('Service account is missing required fields (project_id, private_key, or client_email)');
    }

    if (expectedProjectId && serviceAccount.project_id !== expectedProjectId) {
      throw new Error(
        `Firebase Admin project mismatch. Expected ${expectedProjectId} but got ${serviceAccount.project_id}`
      );
    }
  }
} catch (e) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY parsing error:', e.message);
}

// Initialize Firebase Admin only if credentials exist
if (serviceAccount && !getApps().length) {
  try {
    // Ensure project id is visible to underlying Google auth libs BEFORE init
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
      process.env.GOOGLE_CLOUD_PROJECT = serviceAccount.project_id;
    }
    if (!process.env.GCLOUD_PROJECT) {
      process.env.GCLOUD_PROJECT = serviceAccount.project_id;
    }
    if (!process.env.FIREBASE_CONFIG) {
      process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: serviceAccount.project_id });
    }
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  } catch (e) {
    console.error('❌ Firebase Admin initialization failed:', e.message);
    if (process.env.NODE_ENV === 'development') {
      throw e;
    }
  }
} else if (!getApps().length) {
  console.warn('⚠️  Firebase Admin not initialized - service account credentials not available');
}

// Safe getter that throws a clear error if admin is not initialized
export const getAuth = () => {
  try {
    // Ensure project env vars are always available at call-time
    // (some server runtimes may not preserve module init ordering)
    if ((!process.env.GCLOUD_PROJECT || !process.env.GOOGLE_CLOUD_PROJECT) && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        if (sa?.project_id) {
          if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = sa.project_id;
          if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = sa.project_id;
          if (!process.env.FIREBASE_CONFIG) {
            process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: sa.project_id });
          }
        }
      } catch {
        // ignore parse errors here; detailed parsing errors are logged during module init
      }
    }
    return adminGetAuth();
  } catch (e) {
    throw new Error('Firebase Admin not initialized. Set FIREBASE_SERVICE_ACCOUNT_KEY.');
  }
};