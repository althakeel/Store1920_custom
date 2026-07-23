import { NextResponse } from 'next/server';
import { createMathCaptcha } from '@/lib/authSecurity';

export const dynamic = 'force-dynamic';

export async function GET() {
  const challenge = createMathCaptcha();
  return NextResponse.json({
    ...challenge,
    googleSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '',
  });
}
