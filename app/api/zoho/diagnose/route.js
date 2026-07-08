import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ACCOUNTS_DOMAINS = {
  com: 'accounts.zoho.com',
  sa: 'accounts.zoho.sa',
  eu: 'accounts.zoho.eu',
  in: 'accounts.zoho.in',
  'com.au': 'accounts.zoho.com.au',
  jp: 'accounts.zoho.jp',
};

// GET /api/zoho/diagnose — tries the refresh token against every Zoho data
// center and reports which region works. Helps find the right ZOHO_REGION.
export async function GET() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return NextResponse.json(
      { ok: false, message: 'Missing ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET or ZOHO_REFRESH_TOKEN.' },
      { status: 200 },
    );
  }

  const results = {};
  let workingRegion = null;

  for (const [region, domain] of Object.entries(ACCOUNTS_DOMAINS)) {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      });
      const res = await fetch(`https://${domain}/oauth/v2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.access_token) {
        results[region] = 'OK';
        if (!workingRegion) workingRegion = region;
      } else {
        results[region] = data.error || `HTTP ${res.status}`;
      }
    } catch (err) {
      results[region] = `fetch failed: ${String(err?.message || err)}`;
    }
  }

  return NextResponse.json({
    ok: Boolean(workingRegion),
    workingRegion,
    hint: workingRegion
      ? `Set ZOHO_REGION=${workingRegion} in .env and restart the dev server.`
      : 'No region accepted this refresh token. The token/client/secret likely do not match, or the token was revoked. Generate a fresh grant code from the SAME self client and exchange it.',
    resultsByRegion: results,
  });
}
