import imagekit from '@/configs/imageKit';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const authenticationParameters = imagekit.getAuthenticationParameters();
    return NextResponse.json(authenticationParameters, { status: 200 });
  } catch (error) {
    console.error('Error generating ImageKit auth:', error);
    return NextResponse.json({ error: 'Failed to generate authentication' }, { status: 500 });
  }
}
