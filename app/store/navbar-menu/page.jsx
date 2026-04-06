'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import toast from 'react-hot-toast';

const NAVBAR_APPEARANCE_CACHE_KEY = 'navbarAppearanceCacheV1';

export default function NavbarMenuSettingsPage() {
  const { user, getToken, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enabled: true,
    logoUrl: '',
    logoWidth: '',
    logoHeight: '',
    backgroundColor: '#8f3404',
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoWidthRef = useRef(null);
  const logoHeightRef = useRef(null);

  const normalizeLogoWidth = (value) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(20, Math.min(400, parsed));
  };

  const normalizeLogoHeight = (value) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(10, Math.min(200, parsed));
  };

  const previewWidth = useMemo(() => normalizeLogoWidth(form.logoWidth), [form.logoWidth]);
  const previewHeight = useMemo(() => normalizeLogoHeight(form.logoHeight), [form.logoHeight]);

  const getAuthToken = async (forceRefresh = false) => {
    if (user?.getIdToken) {
      return user.getIdToken(forceRefresh);
    }
    return getToken(forceRefresh);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(
      NAVBAR_APPEARANCE_CACHE_KEY,
      JSON.stringify({
        logoUrl: form.logoUrl,
        logoWidth: previewWidth,
        logoHeight: previewHeight,
        backgroundColor: form.backgroundColor,
      })
    );

    window.dispatchEvent(
      new CustomEvent('navbarAppearanceUpdated', {
        detail: {
          logoUrl: form.logoUrl,
          logoWidth: previewWidth,
          logoHeight: previewHeight,
          backgroundColor: form.backgroundColor,
        },
      })
    );
  }, [form.logoUrl, form.backgroundColor, previewWidth, previewHeight]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    let isActive = true;

    const fetchSettings = async () => {
      try {
        let token = await getAuthToken(false);
        if (!token) token = await getAuthToken(true);
        if (!token) {
          toast.error('Could not authenticate to load saved settings');
          if (isActive) setLoading(false);
          return;
        }

        let response = await fetch('/api/store/navbar-menu', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          const retryToken = await getAuthToken(true);
          if (retryToken) {
            response = await fetch('/api/store/navbar-menu', {
              cache: 'no-store',
              headers: { Authorization: `Bearer ${retryToken}` },
            });
          }
        }

        if (!response.ok) {
          let message = 'Failed to load saved settings';
          try {
            const err = await response.json();
            if (err?.error) message = err.error;
          } catch (_) {
            // ignore JSON parse errors
          }
          toast.error(message);
          if (isActive) setLoading(false);
          return;
        }
        const data = await response.json();
        if (!isActive) return;
        const nextWidth = normalizeLogoWidth(data.logoWidth);
        const nextHeight = normalizeLogoHeight(data.logoHeight);
        setForm({
          enabled: data.enabled ?? true,
          logoUrl: data.logoUrl || '',
          logoWidth: nextWidth == null ? '' : String(nextWidth),
          logoHeight: nextHeight == null ? '' : String(nextHeight),
          backgroundColor: data.backgroundColor || '#8f3404',
        });
      } catch (error) {
        console.error('Navbar menu fetch error:', error);
        toast.error('Failed to load navbar menu');
      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchSettings();

    return () => {
      isActive = false;
    };
  }, [authLoading, user?.uid]);

  const handleSave = async () => {
    if (!user) {
      toast.error('Please sign in to save changes');
      return;
    }

    const liveWidth = logoWidthRef.current?.value;
    const liveHeight = logoHeightRef.current?.value;
    const nextWidth = normalizeLogoWidth(liveWidth ?? form.logoWidth);
    const nextHeight = normalizeLogoHeight(liveHeight ?? form.logoHeight);
    if (nextWidth == null || nextHeight == null) {
      toast.error('Enter valid width and height before saving');
      return;
    }
    const nextBackgroundColor = String(form.backgroundColor || '').trim() || '#8f3404';
    const nextLogoUrl = String(form.logoUrl || '').trim();

    setForm((prev) => ({
      ...prev,
      logoUrl: nextLogoUrl,
      logoWidth: String(nextWidth),
      logoHeight: String(nextHeight),
      backgroundColor: nextBackgroundColor,
    }));

    setSaving(true);
    try {
      let token = await getAuthToken(false);
      if (!token) token = await getAuthToken(true);
      if (!token) {
        throw new Error('Authentication required');
      }
      let activeToken = token;

      const payload = {
        enabled: !!form.enabled,
        logoUrl: nextLogoUrl,
        logoWidth: nextWidth,
        logoHeight: nextHeight,
        backgroundColor: nextBackgroundColor,
        items: [],
      };

      let response = await fetch('/api/store/navbar-menu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        const retryToken = await getAuthToken(true);
        if (retryToken) {
          activeToken = retryToken;
          response = await fetch('/api/store/navbar-menu', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${retryToken}`,
            },
            body: JSON.stringify(payload),
          });
        }
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save menu');
      }

      const verifyResponse = await fetch('/api/store/navbar-menu', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const savedWidthFromPost = normalizeLogoWidth(data?.data?.logoWidth);
      const savedHeightFromPost = normalizeLogoHeight(data?.data?.logoHeight);

      let verifiedWidth = savedWidthFromPost ?? nextWidth;
      let verifiedHeight = savedHeightFromPost ?? nextHeight;
      let verifiedLogoUrl = data?.data?.logoUrl || nextLogoUrl;
      let verifiedBackgroundColor = data?.data?.backgroundColor || nextBackgroundColor;
      let verifiedEnabled = data?.data?.enabled ?? form.enabled;

      if (verifyResponse.ok) {
        const verified = await verifyResponse.json();
        const fromGetWidth = normalizeLogoWidth(verified.logoWidth);
        const fromGetHeight = normalizeLogoHeight(verified.logoHeight);
        verifiedWidth = fromGetWidth ?? verifiedWidth;
        verifiedHeight = fromGetHeight ?? verifiedHeight;
        verifiedLogoUrl = verified.logoUrl || verifiedLogoUrl;
        verifiedBackgroundColor = verified.backgroundColor || verifiedBackgroundColor;
        verifiedEnabled = verified.enabled ?? verifiedEnabled;
      }

      setForm((prev) => ({
        ...prev,
        enabled: verifiedEnabled,
        logoUrl: verifiedLogoUrl,
        logoWidth: verifiedWidth == null ? '' : String(verifiedWidth),
        logoHeight: verifiedHeight == null ? '' : String(verifiedHeight),
        backgroundColor: verifiedBackgroundColor,
      }));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('navbarAppearanceUpdated', {
            detail: {
              logoUrl: verifiedLogoUrl,
              logoWidth: verifiedWidth,
              logoHeight: verifiedHeight,
              backgroundColor: verifiedBackgroundColor,
            },
          })
        );
      }

      const savedAt = data?.meta?.updatedAt ? ` (saved: ${new Date(data.meta.updatedAt).toLocaleTimeString()})` : '';
      const sentWidth = data?.meta?.receivedLogoWidth;
      const sentHeight = data?.meta?.receivedLogoHeight;
      const savedWidth = data?.meta?.savedLogoWidth;
      const savedHeight = data?.meta?.savedLogoHeight;
      toast.success(
        `Navbar menu updated${savedAt} sent:${sentWidth}x${sentHeight} saved:${savedWidth}x${savedHeight} verify:${verifiedWidth}x${verifiedHeight}`
      );
      if (!verifyResponse.ok) {
        toast('Saved, but live verify request failed. Refresh once to confirm.', { icon: '⚠️' });
      }
    } catch (error) {
      console.error('Navbar menu save error:', error);
      toast.error(error.message || 'Failed to save menu');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!user) {
      toast.error('Please sign in to upload logo');
      return;
    }

    setUploadingLogo(true);
    try {
      let token = await getAuthToken(false);
      if (!token) token = await getAuthToken(true);
      if (!token) {
        throw new Error('Authentication required');
      }
      const formData = new FormData();
      formData.append('image', file);
      formData.append('type', 'logo');

      const response = await fetch('/api/store/upload-image', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to upload logo');
      }

      setForm((prev) => ({ ...prev, logoUrl: data.url || '' }));
      toast.success('Navbar logo uploaded');
    } catch (error) {
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-500">Loading...</div>;
  }

  if (!user) {
    return <div className="p-6 text-slate-500">Please sign in to manage the navbar menu.</div>;
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Navbar Menu</h1>
            <p className="text-sm text-slate-500 mt-1">Manage the links shown below the main navbar.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <input
          id="navbar-enabled"
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
          className="h-4 w-4"
        />
        <label htmlFor="navbar-enabled" className="text-sm text-slate-700">
          Enable navbar menu
        </label>
      </div>

      <div className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700">Navbar logo</label>
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              {uploadingLogo ? 'Uploading...' : 'Upload logo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
            </label>
            {form.logoUrl ? (
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, logoUrl: '' }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
              >
                Remove
              </button>
            ) : null}
          </div>
          {form.logoUrl ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <img
                src={form.logoUrl}
                alt="Navbar logo preview"
                style={{ width: previewWidth ?? undefined, height: previewHeight ?? undefined, objectFit: 'contain' }}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500">If empty, the default site logo will be used.</p>
          )}
          {form.logoUrl && (
            <div className="flex items-center gap-3 mt-1">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-semibold text-slate-500">Width (px)</label>
                <input
                  ref={logoWidthRef}
                  type="number"
                  min={20}
                  max={400}
                  value={form.logoWidth}
                  onChange={(e) => setForm((prev) => ({ ...prev, logoWidth: e.target.value }))}
                  onBlur={(e) => {
                    const normalized = normalizeLogoWidth(e.target.value);
                    setForm((prev) => ({ ...prev, logoWidth: normalized == null ? '' : String(normalized) }));
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-full"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-semibold text-slate-500">Height (px)</label>
                <input
                  ref={logoHeightRef}
                  type="number"
                  min={10}
                  max={200}
                  value={form.logoHeight}
                  onChange={(e) => setForm((prev) => ({ ...prev, logoHeight: e.target.value }))}
                  onBlur={(e) => {
                    const normalized = normalizeLogoHeight(e.target.value);
                    setForm((prev) => ({ ...prev, logoHeight: normalized == null ? '' : String(normalized) }));
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-full"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="navbar-background-color" className="text-sm font-semibold text-slate-700">Navbar background color</label>
          <div className="flex items-center gap-3">
            <input
              id="navbar-background-color"
              type="color"
              value={form.backgroundColor}
              onChange={(e) => setForm((prev) => ({ ...prev, backgroundColor: e.target.value }))}
              className="h-11 w-16 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
            />
            <input
              type="text"
              value={form.backgroundColor}
              onChange={(e) => setForm((prev) => ({ ...prev, backgroundColor: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="#8f3404"
            />
          </div>
          <div className="h-11 rounded-xl border border-slate-200" style={{ backgroundColor: form.backgroundColor }} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}
