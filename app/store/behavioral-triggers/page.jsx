'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { Mail, Play, RefreshCw, Save, Zap } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import PageSkeleton from '@/components/PageSkeleton';
import { readPageCache, writePageCache } from '@/lib/storePageCache';
import toast from 'react-hot-toast';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function BehavioralTriggersPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState('');
  const [data, setData] = useState(null);
  const [triggers, setTriggers] = useState({});
  const [expandedId, setExpandedId] = useState('first_purchase');

  const cacheKey = 'behavioral-triggers';

  useEffect(() => {
    const cached = readPageCache(cacheKey);
    if (cached) {
      setData(cached);
      setTriggers(cached.triggers || {});
      setLoading(false);
    }
  }, []);

  const loadTriggers = useCallback(async ({ silent = false } = {}) => {
    const cached = readPageCache(cacheKey);
    try {
      if (!silent && !cached) setLoading(true);

      let token = await getToken(false);
      if (!token) token = await getToken(true);

      const response = await axios.get('/api/store/behavioral-triggers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
      setTriggers(response.data.triggers || {});
      writePageCache(cacheKey, response.data);
    } catch (error) {
      console.error('Failed to load behavioral triggers:', error);
      if (!cached) toast.error('Failed to load behavioral triggers');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadTriggers({ silent: Boolean(readPageCache(cacheKey)) });
  }, [loadTriggers]);

  const updateTrigger = (triggerId, patch) => {
    setTriggers((current) => ({
      ...current,
      [triggerId]: {
        ...(current[triggerId] || {}),
        ...patch,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await getToken();
      await axios.patch(
        '/api/store/behavioral-triggers',
        { triggers },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Trigger settings saved');
      await loadTriggers();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async (triggerId, dryRun = false) => {
    try {
      setRunningId(triggerId);
      const token = await getToken();
      const response = await axios.post(
        '/api/store/behavioral-triggers',
        { triggerId, dryRun },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (dryRun) {
        const count = response.data?.result?.eligible ?? response.data?.eligiblePreview?.[triggerId] ?? 0;
        toast.success(`${count} customer(s) eligible right now`);
      } else {
        const sent = response.data?.result?.sent ?? response.data?.results?.reduce((sum, row) => sum + (row.sent || 0), 0) ?? 0;
        toast.success(`Sent ${sent} email(s)`);
        await loadTriggers();
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to run trigger');
    } finally {
      setRunningId('');
    }
  };

  if (loading && !data) return <PageSkeleton />;

  const catalog = data?.catalog || [];
  const logs = data?.logs || [];

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <Zap size={24} className="text-violet-600" />
            Behavioral Trigger Engine
          </h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Automatically send emails when customers hit key lifecycle events — first purchase, inactivity, anniversaries, and more.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save settings'}
          </button>
          <button
            type="button"
            onClick={() => handleRun('all', false)}
            disabled={Boolean(runningId)}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            <Play size={16} />
            Run all enabled
          </button>
          <Link
            href="/store/marketing-stack"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Marketing stack
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-950">
        <p className="font-semibold">Template variables</p>
        <p className="mt-1 text-violet-900">
          Use {(data?.templateVariables || []).map((item) => `{{${item}}}`).join(', ')} in subject and body.
        </p>
        <p className="mt-2 text-xs text-violet-800">
          Emails respect promotional opt-out. Duplicate sends are blocked by cooldown rules per trigger.
        </p>
      </div>

      <div className="space-y-3">
        {catalog.map((trigger) => {
          const settings = triggers[trigger.id] || trigger.settings || {};
          const isOpen = expandedId === trigger.id;

          return (
            <div key={trigger.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? '' : trigger.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Mail size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{trigger.name}</p>
                  <p className="text-xs text-slate-500">{trigger.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase text-slate-500">Eligible now</p>
                  <p className="text-lg font-bold text-slate-900">{trigger.eligibleCount || 0}</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.enabled)}
                    onChange={(event) => updateTrigger(trigger.id, { enabled: event.target.checked })}
                  />
                  Enabled
                </label>
              </button>

              {isOpen ? (
                <div className="space-y-3 border-t border-slate-100 px-4 py-4">
                  {(trigger.id === 'no_order_90_days') ? (
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-700">Days inactive</span>
                      <input
                        type="number"
                        min="7"
                        value={settings.daysInactive ?? 90}
                        onChange={(event) => updateTrigger(trigger.id, { daysInactive: Number(event.target.value) })}
                        className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </label>
                  ) : null}

                  {(trigger.id === 'second_purchase_nudge') ? (
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-700">Days after first order</span>
                      <input
                        type="number"
                        min="1"
                        value={settings.daysAfterFirst ?? 14}
                        onChange={(event) => updateTrigger(trigger.id, { daysAfterFirst: Number(event.target.value) })}
                        className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </label>
                  ) : null}

                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Email subject</span>
                    <input
                      type="text"
                      value={settings.subject || ''}
                      onChange={(event) => updateTrigger(trigger.id, { subject: event.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Email body (HTML)</span>
                    <textarea
                      rows={8}
                      value={settings.bodyHtml || ''}
                      onChange={(event) => updateTrigger(trigger.id, { bodyHtml: event.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleRun(trigger.id, true)}
                      disabled={runningId === trigger.id}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Preview eligible
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRun(trigger.id, false)}
                      disabled={runningId === trigger.id || !settings.enabled}
                      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                    >
                      <RefreshCw size={14} className={runningId === trigger.id ? 'animate-spin' : ''} />
                      Send now
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Recent trigger activity</h2>
        </div>
        {!logs.length ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No trigger emails sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">When</th>
                  <th className="px-3 py-3">Trigger</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3">Subject</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-600">{formatDate(log.sentAt)}</td>
                    <td className="px-3 py-3 text-slate-600">{log.triggerId}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{log.customerName || 'Customer'}</p>
                      <p className="text-xs text-slate-500">{log.customerEmail}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        log.status === 'sent'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.subject}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
