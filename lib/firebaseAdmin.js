import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
const expectedProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (expectedProjectId && serviceAccount.project_id && serviceAccount.project_id !== expectedProjectId) {
  throw new Error(
    `Firebase Admin project mismatch. Expected ${expectedProjectId} but got ${serviceAccount.project_id}`
  );
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

export default admin;
