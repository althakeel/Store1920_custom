"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { deleteItemFromCart, setCartEntry, uploadCart } from '@/lib/features/cart/cartSlice';
import { useAuth } from '@/lib/useAuth';
import { buildFreeGiftCartKey, isFreeGiftEntry } from '@/lib/freeGiftUtils';

const DISABLED_PREFIXES = ['/store', '/admin', '/dashboard'];

export default function GiveawayCartManager() {
  const pathname = usePathname();
  const dispatch = useDispatch();
  const { getToken, user } = useAuth();
  const cartItems = useSelector((state) => state.cart.cartItems);

  useEffect(() => {
    if (DISABLED_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) {
      return undefined;
    }

    let ignore = false;

    const syncGiveaway = async () => {
      const entries = Object.entries(cartItems || {});
      const giftEntries = entries.filter(([, entry]) => isFreeGiftEntry(entry));
      const regularEntries = entries.filter(([, entry]) => !isFreeGiftEntry(entry));

      if (!regularEntries.length) {
        if (giftEntries.length) {
          giftEntries.forEach(([key]) => dispatch(deleteItemFromCart({ productId: key })));
          if (user) {
            await dispatch(uploadCart({ getToken }));
          }
        }
        return;
      }

      const response = await fetch('/api/giveaways/eligible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartItems }),
      });
      const data = await response.json();
      if (ignore) return;

      let changed = false;

      if (!response.ok || !data?.eligible || !data?.campaign?._id || !data?.giftProduct?._id) {
        if (giftEntries.length) {
          giftEntries.forEach(([key]) => dispatch(deleteItemFromCart({ productId: key })));
          changed = true;
        }
      } else {
        const desiredKey = buildFreeGiftCartKey(data.campaign._id, data.giftProduct._id);
        const desiredEntry = {
          quantity: 1,
          price: 0,
          freeGift: {
            campaignId: data.campaign._id,
            title: data.campaign.title,
            giftProductId: data.giftProduct._id,
          },
        };

        giftEntries.forEach(([key]) => {
          if (key !== desiredKey) {
            dispatch(deleteItemFromCart({ productId: key }));
            changed = true;
          }
        });

        const existing = cartItems?.[desiredKey];
        const existingGift = existing?.freeGift || {};
        const matchesDesired =
          existing &&
          Number(existing?.quantity || 0) === 1 &&
          Number(existing?.price || 0) === 0 &&
          existingGift?.campaignId === desiredEntry.freeGift.campaignId &&
          existingGift?.giftProductId === desiredEntry.freeGift.giftProductId;

        if (!matchesDesired) {
          dispatch(setCartEntry({ productId: desiredKey, entry: desiredEntry }));
          changed = true;
        }
      }

      if (changed && user) {
        await dispatch(uploadCart({ getToken }));
      }
    };

    const timer = setTimeout(() => {
      syncGiveaway().catch((error) => {
        console.error('Giveaway cart sync failed:', error);
      });
    }, 200);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [cartItems, dispatch, getToken, pathname, user]);

  return null;
}