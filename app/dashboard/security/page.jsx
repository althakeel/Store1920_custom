'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, sendEmailVerification, signOut } from 'firebase/auth';
import toast from 'react-hot-toast';
import PageTitle from '@/components/PageTitle';
import { auth } from '@/lib/firebase';
import { getStoredSessionId, setStoredSessionId, setMfaVerified } from '@/lib/authClient';

export default function AccountSecurityPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [idleMs, setIdleMs] = useState(30 * 60 * 1000);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSetupSent, setMfaSetupSent] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [busy, setBusy] = useState('');

  const authHeaders = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  const loadSessions = useCallback(async () => {
    if (!auth.currentUser) return;
    const headers = await authHeaders();
    const sessionId = getStoredSessionId();
    const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    const res = await fetch(`/api/auth/sessions${qs}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions || []);
      if (data.idleMs) setIdleMs(data.idleMs);
    }
  }, [authHeaders]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push('/sign-in');
        return;
      }
      setUser(u);
      setLoading(false);
      try {
        const token = await u.getIdToken();
        const mfaRes = await fetch('/api/auth/mfa', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (mfaRes.ok) {
          const mfaData = await mfaRes.json();
          setMfaEnabled(Boolean(mfaData.twoFactorEnabled));
        }
      } catch {
        // ignore
      }
      await loadSessions();
    });
    return () => unsub();
  }, [router, loadSessions]);

  const sendEmailVerify = async () => {
    setBusy('email');
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser).catch(() => {});
      }
      const headers = await authHeaders();
      const res = await fetch('/api/auth/email-verify', { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Verification code sent to your email');
    } catch (e) {
      toast.error(e.message || 'Failed to send');
    } finally {
      setBusy('');
    }
  };

  const confirmEmail = async () => {
    setBusy('emailConfirm');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/auth/email-verify', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ code: emailCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      await auth.currentUser?.reload();
      setUser(auth.currentUser);
      toast.success('Email verified');
      setEmailCode('');
    } catch (e) {
      toast.error(e.message || 'Invalid code');
    } finally {
      setBusy('');
    }
  };

  const sendPhone = async () => {
    setBusy('phone');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/auth/phone-verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.message || 'Code sent');
    } catch (e) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusy('');
    }
  };

  const confirmPhone = async () => {
    setBusy('phoneConfirm');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/auth/phone-verify', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ phone, code: phoneCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Phone verified');
      setPhoneCode('');
    } catch (e) {
      toast.error(e.message || 'Invalid code');
    } finally {
      setBusy('');
    }
  };

  const startMfaSetup = async () => {
    setBusy('mfa');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers,
        body: JSON.stringify({ setup: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setMfaSetupSent(true);
      toast.success('MFA code sent to your email');
    } catch (e) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusy('');
    }
  };

  const confirmMfaEnable = async () => {
    setBusy('mfaConfirm');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/auth/mfa', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ code: mfaCode, setup: true, enable: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setMfaEnabled(true);
      setMfaVerified(true);
      toast.success('MFA enabled');
      setMfaCode('');
    } catch (e) {
      toast.error(e.message || 'Invalid code');
    } finally {
      setBusy('');
    }
  };

  const disableMfa = async () => {
    setBusy('mfaOff');
    try {
      const headers = await authHeaders();
      await fetch('/api/auth/mfa', {
        method: 'POST',
        headers,
        body: JSON.stringify({ setup: true }),
      });
      const res = await fetch('/api/auth/mfa', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ code: mfaCode, disable: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enter a fresh MFA code, then disable');
      setMfaEnabled(false);
      toast.success('MFA disabled');
    } catch (e) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusy('');
    }
  };

  const revokeSession = async (sessionId) => {
    setBusy(sessionId);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error('Failed');
      if (sessionId === getStoredSessionId()) {
        setStoredSessionId('');
        await signOut(auth);
        router.push('/sign-in');
        return;
      }
      toast.success('Session revoked');
      await loadSessions();
    } catch (e) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusy('');
    }
  };

  const logoutAll = async () => {
    setBusy('all');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setStoredSessionId('');
      setMfaVerified(false);
      await signOut(auth);
      toast.success('Signed out from all devices');
      router.push('/sign-in');
    } catch (e) {
      toast.error(e.message || 'Failed');
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  const idleMinutes = Math.round(idleMs / 60000);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <PageTitle title="Account security" />
        <p className="text-sm text-gray-600">
          Passwords are hashed by Firebase Auth. Sessions idle out after about {idleMinutes} minutes.
          ID tokens expire (~1 hour) and refresh automatically until you revoke devices.
        </p>

        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Email verification</h2>
          <p className="text-sm text-gray-600">
            Status:{' '}
            <span className={user?.emailVerified ? 'text-green-700' : 'text-amber-700'}>
              {user?.emailVerified ? 'Verified' : 'Not verified'}
            </span>
          </p>
          {!user?.emailVerified ? (
            <>
              <button
                type="button"
                disabled={busy === 'email'}
                onClick={sendEmailVerify}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg disabled:opacity-50"
              >
                Send verification code
              </button>
              <div className="flex gap-2">
                <input
                  className="border rounded-lg px-3 py-2 text-sm flex-1"
                  placeholder="Email code"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy === 'emailConfirm'}
                  onClick={confirmEmail}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Confirm
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Phone verification</h2>
          <input
            className="border rounded-lg px-3 py-2 text-sm w-full"
            placeholder="+9715…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            type="button"
            disabled={busy === 'phone'}
            onClick={sendPhone}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg disabled:opacity-50"
          >
            Send phone code
          </button>
          <div className="flex gap-2">
            <input
              className="border rounded-lg px-3 py-2 text-sm flex-1"
              placeholder="SMS / email code"
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value)}
            />
            <button type="button" disabled={busy === 'phoneConfirm'} onClick={confirmPhone} className="px-4 py-2 border rounded-lg text-sm">
              Confirm
            </button>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Multi-factor authentication (email OTP)</h2>
          <p className="text-sm text-gray-600">
            {mfaEnabled ? 'MFA is enabled for your account.' : 'Add a second step after password login.'}
          </p>
          {!mfaEnabled ? (
            <>
              <button
                type="button"
                disabled={busy === 'mfa'}
                onClick={startMfaSetup}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg disabled:opacity-50"
              >
                Send MFA setup code
              </button>
              {mfaSetupSent ? (
                <div className="flex gap-2">
                  <input
                    className="border rounded-lg px-3 py-2 text-sm flex-1"
                    placeholder="MFA code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                  />
                  <button type="button" disabled={busy === 'mfaConfirm'} onClick={confirmMfaEnable} className="px-4 py-2 border rounded-lg text-sm">
                    Enable MFA
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-2">
              <input
                className="border rounded-lg px-3 py-2 text-sm w-full"
                placeholder="Current MFA code to disable"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
              />
              <button type="button" disabled={busy === 'mfaOff'} onClick={disableMfa} className="px-4 py-2 border border-red-300 text-red-700 text-sm rounded-lg">
                Disable MFA
              </button>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-900">Devices &amp; sessions</h2>
            <button
              type="button"
              disabled={busy === 'all'}
              onClick={logoutAll}
              className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded-lg"
            >
              Log out all devices
            </button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-gray-500">No active tracked sessions yet. Sign in again to register this device.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sessions.map((s) => (
                <li key={s.sessionId} className="py-3 flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">
                      {s.deviceLabel}{s.current || s.sessionId === getStoredSessionId() ? ' · This device' : ''}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {s.ip || 'IP unknown'} · Last seen {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : '—'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === s.sessionId}
                    onClick={() => revokeSession(s.sessionId)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
