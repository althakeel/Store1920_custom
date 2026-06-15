export const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
export const FIREBASE_AUTH_DOMAIN =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
  (FIREBASE_PROJECT_ID ? `${FIREBASE_PROJECT_ID}.firebaseapp.com` : '');

export const REQUIRED_FIREBASE_AUTHORIZED_DOMAINS = [
  'localhost',
  'store1920.com',
  'www.store1920.com',
  'store1920.store',
  'www.store1920.store',
  `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
  `${FIREBASE_PROJECT_ID}.web.app`,
].filter(Boolean);

export function isValidGoogleOAuthClientId(value) {
  return /^[\d]+-[\w-]+\.apps\.googleusercontent\.com$/.test(String(value || '').trim());
}

export function getGoogleOAuthClientId() {
  const value = String(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
  return isValidGoogleOAuthClientId(value) ? value : '';
}

export function getFirebaseClientDiagnostics() {
  const googleClientId = String(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
  const appUrl = String(
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
  ).replace(/\/+$/, '');

  return {
    projectId: FIREBASE_PROJECT_ID,
    authDomain: FIREBASE_AUTH_DOMAIN,
    appUrl,
    googleClientIdConfigured: Boolean(googleClientId),
    googleClientIdValid: isValidGoogleOAuthClientId(googleClientId),
    requiredAuthorizedDomains: REQUIRED_FIREBASE_AUTHORIZED_DOMAINS,
    firebaseConsoleAuthSettingsUrl: FIREBASE_PROJECT_ID
      ? `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`
      : null,
  };
}
