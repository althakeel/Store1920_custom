/**
 * Zoho OAuth2 foundation (self-client / server-to-server).
 *
 * This module is product-agnostic: the same access token works for Zoho CRM,
 * Books, Inventory, Cliq, etc. — you just request the right scopes when you
 * generate the refresh token in the Zoho API Console.
 *
 * Required environment variables (add to .env, never commit real values):
 *   ZOHO_CLIENT_ID        = 1000.XXXXXXXX...
 *   ZOHO_CLIENT_SECRET    = <secret>            (rotate the one that was shared!)
 *   ZOHO_REFRESH_TOKEN    = 1000.yyyy...        (generated once, see notes below)
 *   ZOHO_REGION           = com | eu | in | com.au | jp | sa   (default: com)
 *
 * How to get the refresh token (one-time), using your self-client:
 *   1. In the API Console, open your self-client and generate a "grant token"
 *      (code) with the scopes you need, e.g. for CRM:
 *        ZohoCRM.modules.ALL,ZohoCRM.settings.ALL
 *   2. Exchange that code once for a refresh token:
 *        POST https://accounts.zoho.<region>/oauth/v2/token
 *          grant_type=authorization_code
 *          client_id=...&client_secret=...&code=<grant token>
 *      Save the returned "refresh_token" into ZOHO_REFRESH_TOKEN.
 *   (The refresh token is long-lived; access tokens are auto-refreshed below.)
 */

const REGION_ACCOUNTS_DOMAINS = {
  com: 'accounts.zoho.com',
  eu: 'accounts.zoho.eu',
  in: 'accounts.zoho.in',
  'com.au': 'accounts.zoho.com.au',
  au: 'accounts.zoho.com.au',
  jp: 'accounts.zoho.jp',
  sa: 'accounts.zoho.sa',
};

// Default API base per region (CRM/Books/Inventory live under www.zohoapis.<region>).
const REGION_API_DOMAINS = {
  com: 'www.zohoapis.com',
  eu: 'www.zohoapis.eu',
  in: 'www.zohoapis.in',
  'com.au': 'www.zohoapis.com.au',
  au: 'www.zohoapis.com.au',
  jp: 'www.zohoapis.jp',
  sa: 'www.zohoapis.sa',
};

function getRegion() {
  return String(process.env.ZOHO_REGION || 'com').trim().toLowerCase();
}

export function getZohoAccountsDomain() {
  const override = String(process.env.ZOHO_ACCOUNTS_DOMAIN || '').trim();
  if (override) {
    return override.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
  return REGION_ACCOUNTS_DOMAINS[getRegion()] || REGION_ACCOUNTS_DOMAINS.com;
}

export function getZohoApiDomain() {
  const raw = process.env.ZOHO_API_DOMAIN
    || REGION_API_DOMAINS[getRegion()]
    || REGION_API_DOMAINS.com;
  return String(raw).replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function getZohoOrganizationId() {
  return String(process.env.ZOHO_ORGANIZATION_ID || '').trim();
}

export function isZohoInventoryConfigured() {
  if (!isZohoConfigured()) return false;
  if (!getZohoOrganizationId()) return false;
  const flag = String(process.env.ZOHO_INVENTORY_ENABLED || 'true').trim().toLowerCase();
  return flag !== 'false' && flag !== '0';
}

export function isZohoConfigured() {
  return Boolean(
    process.env.ZOHO_CLIENT_ID
    && process.env.ZOHO_CLIENT_SECRET
    && process.env.ZOHO_REFRESH_TOKEN,
  );
}

// Simple in-memory cache so we don't refresh on every request.
let cachedToken = null; // { accessToken, expiresAt }

/**
 * Returns a valid Zoho access token, refreshing it via the refresh token when
 * expired. Throws if the integration is not configured or Zoho rejects it.
 */
export async function getZohoAccessToken({ force = false } = {}) {
  if (!isZohoConfigured()) {
    throw new Error(
      'Zoho is not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN.',
    );
  }

  const now = Date.now();
  if (!force && cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.accessToken;
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
  });

  const res = await fetch(`https://${getZohoAccountsDomain()}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Zoho token refresh failed: ${data.error || res.status} ${JSON.stringify(data)}`,
    );
  }

  const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + expiresInMs,
  };
  return cachedToken.accessToken;
}

/**
 * Authenticated request against any Zoho API.
 * @param {string} path - path beginning with "/", e.g. "/crm/v6/Contacts"
 * @param {object} options - fetch options (method, body, headers, baseDomain)
 */
export async function zohoApiFetch(path, { baseDomain, headers = {}, ...options } = {}) {
  const token = await getZohoAccessToken();
  const domain = baseDomain || getZohoApiDomain();
  const url = path.startsWith('http') ? path : `https://${domain}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  // One retry on 401 in case the cached token was invalidated server-side.
  if (res.status === 401) {
    const freshToken = await getZohoAccessToken({ force: true });
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Zoho-oauthtoken ${freshToken}`,
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  }

  return res;
}

/**
 * Authenticated Zoho Inventory API request (adds organization_id query param).
 */
export async function zohoInventoryApiFetch(path, { query = {}, skipOrgId = false, ...options } = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, String(value));
  });

  const orgId = getZohoOrganizationId();
  if (!skipOrgId && orgId && !params.has('organization_id')) {
    params.set('organization_id', orgId);
  }

  const inventoryPath = path.startsWith('/inventory/')
    ? path
    : `/inventory/v1${path.startsWith('/') ? path : `/${path}`}`;
  const qs = params.toString();
  const fullPath = qs ? `${inventoryPath}?${qs}` : inventoryPath;

  return zohoApiFetch(fullPath, options);
}
