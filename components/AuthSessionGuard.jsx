'use client';

import { useEffect, useRef, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  getStoredSessionId,
  setStoredSessionId,
  setMfaVerified,
} from '@/lib/authClient';

const HEARTBEAT_MS = 60_000;

/**
 * Idle session timeout + session heartbeat.
 * Signs out when idleMs elapses without user activity, or server session is revoked.
 */
export default function AuthSessionGuard() {
  const idleTimer = useRef(null);
  const idleMsRef = useRef(30 * 60 * 1000);

  const clearSessionLocal = useCallback(() => {
    setStoredSessionId('');
    setMfaVerified(false);
  }, []);

  const forceSignOut = useCallback(async (reason) => {
    clearSessionLocal();
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined' && reason) {
      console.info('[AuthSessionGuard]', reason);
    }
  }, [clearSessionLocal]);

  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (!auth.currentUser) return;
    idleTimer.current = setTimeout(() => {
      void forceSignOut('Session timed out due to inactivity');
    }, idleMsRef.current);
  }, [forceSignOut]);

  useEffect(() => {
    let heartbeat;
    let unsub = () => {};

    const onActivity = () => resetIdle();

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));

    unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (idleTimer.current) clearTimeout(idleTimer.current);
        return;
      }

      try {
        const token = await user.getIdToken();
        const sessionId = getStoredSessionId();
        const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
        const res = await fetch(`/api/auth/sessions${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.idleMs) idleMsRef.current = data.idleMs;
        }
      } catch {
        // ignore
      }

      resetIdle();

      if (heartbeat) clearInterval(heartbeat);
      heartbeat = setInterval(async () => {
        const current = auth.currentUser;
        if (!current) return;
        const sessionId = getStoredSessionId();
        if (!sessionId) return;
        try {
          const token = await current.getIdToken();
          const res = await fetch('/api/auth/sessions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId }),
          });
          if (res.status === 401) {
            const data = await res.json().catch(() => ({}));
            if (data.expired) {
              await forceSignOut('Session revoked or expired');
            }
          }
        } catch {
          // ignore network blips
        }
      }, HEARTBEAT_MS);
    });

    return () => {
      unsub();
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (heartbeat) clearInterval(heartbeat);
    };
  }, [forceSignOut, resetIdle]);

  return null;
}
