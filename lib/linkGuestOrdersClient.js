import axios from 'axios';

export const GUEST_ORDERS_LINKED_EVENT = 'guest-orders-linked';

export async function linkGuestOrdersForCurrentUser(firebaseUser, token, overrides = {}) {
  if (!firebaseUser || !token) {
    return { linked: false, count: 0 };
  }

  const email = overrides.email || firebaseUser.email || '';
  const phone = overrides.phone || firebaseUser.phoneNumber || firebaseUser.phone || '';

  if (!email && !phone) {
    return { linked: false, count: 0 };
  }

  try {
    const { data } = await axios.post(
      '/api/user/link-guest-orders',
      { email, phone, phoneNumber: phone },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      }
    );

    if (typeof window !== 'undefined' && data?.linked && data.count > 0) {
      window.dispatchEvent(
        new CustomEvent(GUEST_ORDERS_LINKED_EVENT, { detail: { count: data.count } })
      );
    }

    return data;
  } catch {
    return { linked: false, count: 0 };
  }
}
