import { useCallback, useEffect, useState } from 'react';
import { auth } from './firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout: if Firebase hasn't resolved within 3 s (slow init / blocked),
    // treat the user as a guest so components that gate on `loading` don't hang forever.
    const fallback = setTimeout(() => setLoading(false), 3000);

    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      clearTimeout(fallback);
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => {
      clearTimeout(fallback);
      unsubscribe();
    };
  }, []);

  const getToken = useCallback(async (forceRefresh = false) => {
    // Get current user directly from auth instead of state
    const currentUser = auth.currentUser;
    if (!currentUser) {
      // No user is logged in; this is normal for guests.
      return null;
    }
    try {
      const token = await currentUser.getIdToken(forceRefresh);
      return token;
    } catch (error) {
      console.error('[useAuth] Error getting token:', error);
      // Try to refresh the token
      try {
        const token = await currentUser.getIdToken(true);
        return token;
      } catch (retryError) {
        console.error('[useAuth] Error refreshing token:', retryError);
        return null;
      }
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    try {
      await currentUser.reload();
    } catch (error) {
      console.warn('[useAuth] Failed to reload user profile:', error);
    }
    setUser(auth.currentUser);
    return auth.currentUser;
  }, []);

  return { user, loading, getToken, refreshUser };
}
