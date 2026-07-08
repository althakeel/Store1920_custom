import { NextResponse } from 'next/server';
import { isZohoConfigured, getZohoAccessToken, getZohoAccountsDomain, getZohoApiDomain } from '@/lib/zoho';
import { getZohoCrmPublicConfig } from '@/lib/zohoCrm';
import { getZohoInventoryPublicConfig } from '@/lib/zohoInventory';

export const dynamic = 'force-dynamic';

// GET /api/zoho/status — verifies the Zoho OAuth connection is working.
export async function GET() {
  if (!isZohoConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        message: 'Missing ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET or ZOHO_REFRESH_TOKEN.',
      },
      { status: 200 },
    );
  }

  try {
    const token = await getZohoAccessToken({ force: true });
    return NextResponse.json({
      configured: true,
      tokenAcquired: Boolean(token),
      accountsDomain: getZohoAccountsDomain(),
      apiDomain: getZohoApiDomain(),
      crm: getZohoCrmPublicConfig(),
      inventory: getZohoInventoryPublicConfig(),
    });
  } catch (err) {
    return NextResponse.json(
      { configured: true, tokenAcquired: false, error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
