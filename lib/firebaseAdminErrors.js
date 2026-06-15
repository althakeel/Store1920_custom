export function getFirebaseAdminUserMessage(error) {
  const message = String(error?.message || '');

  if (
    message.includes('invalid_grant') ||
    message.includes('Invalid JWT Signature') ||
    message.includes('Error fetching access token')
  ) {
    return 'Firebase server credentials are invalid or expired. Download a new service account JSON from Firebase Console, save it as firebase-service-account.json, set FIREBASE_SERVICE_ACCOUNT_KEY_PATH=./firebase-service-account.json in .env, then restart the dev server. Open /api/debug/firebase-admin to verify.';
  }

  if (message.includes('Firebase Admin not initialized') || message.includes('service account')) {
    return 'Firebase Admin is not configured. Add FIREBASE_SERVICE_ACCOUNT_KEY_PATH=./firebase-service-account.json to your .env file and restart the server.';
  }

  return message || 'Failed to complete Firebase Admin request.';
}
