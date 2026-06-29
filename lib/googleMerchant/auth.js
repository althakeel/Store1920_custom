import { GoogleAuth } from 'google-auth-library';
import { getGoogleMerchantConfig } from './config';

let authClientPromise = null;

async function getAuthClient() {
  if (!authClientPromise) {
    const { serviceAccountJson, scope } = getGoogleMerchantConfig();
    if (!serviceAccountJson) {
      throw new Error('Google Merchant service account credentials are missing');
    }

    authClientPromise = new GoogleAuth({
      credentials: serviceAccountJson,
      scopes: [scope],
    });
  }

  return authClientPromise;
}

export async function getGoogleMerchantAccessToken() {
  const auth = await getAuthClient();
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  if (!token) {
    throw new Error('Failed to obtain Google Merchant API access token');
  }
  return token;
}
