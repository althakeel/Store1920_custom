import { NextResponse } from 'next/server';
import {
  buildCartRestorePayload,
  findAbandonedCartByRestoreToken,
} from '@/lib/abandonedCartRestore';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const cart = await findAbandonedCartByRestoreToken(decodeURIComponent(String(token || '')));

    if (!cart) {
      return NextResponse.json(
        { error: 'This cart link is invalid or has already been completed' },
        { status: 404 },
      );
    }

    const items = buildCartRestorePayload(cart);
    if (!items.length) {
      return NextResponse.json({ error: 'This saved cart has no items left' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      cartId: String(cart._id),
      storeId: String(cart.storeId || ''),
      currency: cart.currency || 'AED',
      cartTotal: cart.cartTotal,
      items,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Failed to restore cart' },
      { status: 500 },
    );
  }
}
