import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/zoho/exchange?code=THE_GRANT_CODE
// One-time helper: exchanges a fresh grant code (from the self client's
// "Generate Code" tab) for a refresh token. Copy the returned refresh_token
// into ZOHO_REFRESH_TOKEN in .env, then delete/ignore this route.
export async function GET(request) {
  const code = new URL(request.url).searchParams.get('code');
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const region = String(process.env.ZOHO_REGION || 'com').trim().toLowerCase();

  const domains = {
    com: 'accounts.zoho.com',
    sa: 'accounts.zoho.sa',
    eu: 'accounts.zoho.eu',
    in: 'accounts.zoho.in',
    'com.au': 'accounts.zoho.com.au',
    jp: 'accounts.zoho.jp',
  };
  const domain = domains[region] || domains.com;

  if (!code) {
    return NextResponse.json({ ok: false, message: 'Add ?code=YOUR_GRANT_CODE to the URL.' }, { status: 400 });
  }
  if (!clientId || !clientSecret) {
    return NextResponse.json({ ok: false, message: 'Missing ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET.' }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
    });
    const res = await fetch(`https://${domain}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.refresh_token) {
      return NextResponse.json({
        ok: true,
        refresh_token: data.refresh_token,
        message: 'Success! Copy refresh_token into ZOHO_REFRESH_TOKEN in .env and restart the dev server.',
        api_domain: data.api_domain,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: data.error || `HTTP ${res.status}`,
        detail: data,
        hint: 'If error is "invalid_code": the grant code expired (10 min) or was already used — generate a fresh one. Make sure it is from the same self client as ZOHO_CLIENT_ID.',
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
