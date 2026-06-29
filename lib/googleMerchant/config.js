const MERCHANT_SCOPE = 'https://www.googleapis.com/auth/content';

export function getGoogleMerchantConfig() {
  const accountId = String(process.env.GOOGLE_MERCHANT_ACCOUNT_ID || '').trim();
  const dataSourceId = String(process.env.GOOGLE_MERCHANT_DATA_SOURCE_ID || '').trim();
  const contentLanguage = String(process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE || 'en').trim() || 'en';
  const feedLabels = String(process.env.GOOGLE_MERCHANT_FEED_LABELS || 'AE')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const defaultCategory = String(
    process.env.GOOGLE_MERCHANT_DEFAULT_PRODUCT_CATEGORY || '5181',
  ).trim();
  const feedToken = String(process.env.GOOGLE_MERCHANT_FEED_TOKEN || '').trim();
  const serviceAccountJson = resolveServiceAccountJson();

  let dataSource = String(process.env.GOOGLE_MERCHANT_DATA_SOURCE || '').trim();
  if (!dataSource && accountId && dataSourceId) {
    dataSource = `accounts/${accountId}/dataSources/${dataSourceId}`;
  }

  return {
    accountId,
    dataSource,
    dataSourceId,
    contentLanguage,
    feedLabels: feedLabels.length ? feedLabels : ['AE'],
    defaultCategory,
    feedToken,
    serviceAccountJson,
    scope: MERCHANT_SCOPE,
    configured: Boolean(accountId && dataSource && serviceAccountJson),
  };
}

function resolveServiceAccountJson() {
  const inline = String(process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON || '').trim();
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch {
      throw new Error('GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
  }

  const firebaseInline = String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (firebaseInline.startsWith('{')) {
    try {
      return JSON.parse(firebaseInline);
    } catch {
      return null;
    }
  }

  return null;
}

export function assertGoogleMerchantConfigured() {
  const config = getGoogleMerchantConfig();
  if (!config.accountId) {
    throw new Error('GOOGLE_MERCHANT_ACCOUNT_ID is not configured');
  }
  if (!config.dataSource) {
    throw new Error('GOOGLE_MERCHANT_DATA_SOURCE_ID is not configured');
  }
  if (!config.serviceAccountJson) {
    throw new Error('GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON is not configured');
  }
  return config;
}
