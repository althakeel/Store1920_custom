'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  Clock3,
  Eye,
  MousePointerClick,
  ScrollText,
  UserCheck,
  Users,
  X,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import Loading from '@/components/Loading';

const VISITOR_PAGE_SIZE = 10;
const EVENT_PAGE_SIZE = 25;

function formatDuration(seconds = 0) {
  const total = Number(seconds || 0);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}m ${remainder}s`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function getVisitorLabel(visitor) {
  if (!visitor) return 'Visitor';
  if (visitor.displayName) return visitor.displayName;
  if (visitor.visitorType === 'logged_in') return 'Customer';
  return 'Guest';
}

function getVisitorSubtitle(visitor) {
  if (!visitor) return null;
  if (visitor.displaySubtitle) return visitor.displaySubtitle;
  if (visitor.visitorType === 'guest' && visitor.anonymousId) {
    return `Browser ID · ${String(visitor.anonymousId).slice(0, 10)}`;
  }
  return null;
}

function getEventLabel(event) {
  const labels = {
    page_view: 'Page view',
    product_view: 'Product view',
    time_on_page: 'Time on page',
    scroll_depth: 'Scroll depth',
    click: 'Click',
    session_start: 'Session start',
    add_to_cart: 'Add to cart',
    checkout_start: 'Checkout started',
    purchase: 'Purchase',
    session_end: 'Session end',
  };
  return labels[event.eventType] || event.eventType;
}

function PaginationBar({
  page,
  totalPages,
  start,
  end,
  total,
  itemLabel,
  onPageChange,
  className = '',
}) {
  if (!total) return null;

  return (
    <div className={`flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <p className="text-xs text-slate-600 sm:text-sm">
        Showing {start}-{end} of {total} {itemLabel}
        {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ''}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          <ChevronLeft size={14} />
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function VisitorDetailModal({
  open,
  onClose,
  visitorKey,
  range,
  getToken,
}) {
  const [loading, setLoading] = useState(false);
  const [eventPage, setEventPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [eventPagination, setEventPagination] = useState(null);

  const fetchDetail = useCallback(async (nextEventPage = 1) => {
    if (!visitorKey) return;

    try {
      setLoading(true);
      const token = await getToken();
      const params = new URLSearchParams({
        range,
        visitorKey,
        detail: '1',
        eventPage: String(nextEventPage),
        eventPageSize: String(EVENT_PAGE_SIZE),
      });

      const response = await axios.get(`/api/store/customer-tracking?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setDetail(response.data.visitor || null);
      setEventPagination(response.data.eventPagination || null);
      setEventPage(nextEventPage);
    } catch (error) {
      console.error('Failed to fetch visitor detail:', error);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, range, visitorKey]);

  useEffect(() => {
    if (!open || !visitorKey) return;
    setEventPage(1);
    fetchDetail(1);
  }, [open, visitorKey, fetchDetail]);

  if (!open) return null;

  const visitor = detail;

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">
              {getVisitorLabel(visitor)}
            </h2>
            {getVisitorSubtitle(visitor) ? (
              <p className="mt-0.5 truncate text-xs text-slate-500">{getVisitorSubtitle(visitor)}</p>
            ) : null}
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              Full tracking history — pages, products, time spent, scroll, and clicks
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading && !visitor ? (
            <div className="py-16 text-center text-sm text-slate-500">Loading visitor activity...</div>
          ) : !visitor ? (
            <div className="py-16 text-center text-sm text-slate-500">No tracking data found for this visitor.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                <div className="rounded-lg bg-blue-50 p-2.5">
                  <p className="text-[10px] uppercase text-blue-700">First seen</p>
                  <p className="mt-1 text-xs font-semibold text-slate-900">{formatDate(visitor.firstSeen)}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-2.5">
                  <p className="text-[10px] uppercase text-blue-700">Last seen</p>
                  <p className="mt-1 text-xs font-semibold text-slate-900">{formatDate(visitor.lastSeen)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[10px] uppercase text-slate-500">Pages</p>
                  <p className="text-sm font-semibold text-slate-900">{visitor.pageViews}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[10px] uppercase text-slate-500">Products</p>
                  <p className="text-sm font-semibold text-slate-900">{visitor.productViews?.length || 0}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[10px] uppercase text-slate-500">Total time</p>
                  <p className="text-sm font-semibold text-slate-900">{formatDuration(visitor.totalTimeSeconds)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[10px] uppercase text-slate-500">Max scroll</p>
                  <p className="text-sm font-semibold text-slate-900">{visitor.maxScrollPercent || 0}%</p>
                </div>
              </div>

              {visitor.pagesVisited?.length ? (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <MapPin size={14} />
                    Where they went
                  </p>
                  <div className="space-y-1.5">
                    {visitor.pagesVisited.map((page, index) => (
                      <div key={`${page}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                          {index + 1}
                        </span>
                        {page}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {visitor.productViews?.length ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Products watched</p>
                  <div className="flex flex-wrap gap-2">
                    {visitor.productViews.map((item) => (
                      <span key={item} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {visitor.sessions?.length ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sessions</p>
                  <div className="space-y-2">
                    {visitor.sessions.map((session) => (
                      <div key={session.sessionKey} className="rounded-lg border border-slate-200 px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">
                            Session · {String(session.sessionId || '').slice(0, 8)}
                          </p>
                          <p className="text-[11px] text-slate-500">{formatDuration(session.totalTimeSeconds)}</p>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {session.pageViews} pages · max scroll {session.maxScrollPercent || 0}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Full activity timeline</p>

                {eventPagination ? (
                  <PaginationBar
                    page={eventPagination.page}
                    totalPages={eventPagination.totalPages}
                    start={eventPagination.start}
                    end={eventPagination.end}
                    total={eventPagination.totalEvents}
                    itemLabel="events"
                    onPageChange={(page) => fetchDetail(page)}
                    className="mb-3"
                  />
                ) : null}

                <div className="space-y-2">
                  {(visitor.allEvents || []).map((event) => (
                    <div key={`${event.id}-${event.createdAt}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                            {getEventLabel(event)}
                          </span>
                          {event.pageType ? (
                            <span className="text-[11px] text-slate-400">{event.pageType}</span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-slate-400">{formatDate(event.createdAt)}</p>
                      </div>

                      {event.pagePath ? (
                        <p className="mt-1.5 break-all text-xs text-slate-700">{event.pagePath}</p>
                      ) : null}

                      {event.metadata?.productSlug || event.metadata?.productName ? (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Product: {event.metadata.productName || event.metadata.productSlug}
                        </p>
                      ) : null}

                      {event.metadata?.seconds ? (
                        <p className="mt-1 text-xs text-emerald-700">
                          Time spent: {formatDuration(event.metadata.seconds)}
                          {event.metadata.maxScrollPercent ? ` · scrolled to ${event.metadata.maxScrollPercent}%` : ''}
                        </p>
                      ) : null}

                      {event.metadata?.depthPercent ? (
                        <p className="mt-1 text-xs text-indigo-700">
                          Scrolled to {event.metadata.depthPercent}%
                          {event.metadata.secondsOnPage
                            ? ` after ${formatDuration(event.metadata.secondsOnPage)} on page`
                            : ''}
                        </p>
                      ) : null}

                      {event.metadata?.href || event.metadata?.text ? (
                        <p className="mt-1 text-xs text-rose-700">
                          Clicked: {event.metadata.text || event.metadata.href}
                          {event.metadata.secondsOnPage
                            ? ` · after ${formatDuration(event.metadata.secondsOnPage)} on page`
                            : ''}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>

                {loading ? (
                  <p className="mt-3 text-center text-xs text-slate-500">Updating timeline...</p>
                ) : null}

                {eventPagination && eventPagination.totalPages > 1 ? (
                  <PaginationBar
                    page={eventPagination.page}
                    totalPages={eventPagination.totalPages}
                    start={eventPagination.start}
                    end={eventPagination.end}
                    total={eventPagination.totalEvents}
                    itemLabel="events"
                    onPageChange={(page) => fetchDetail(page)}
                    className="mt-3"
                  />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomerTrackingPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('week');
  const [visitorPage, setVisitorPage] = useState(1);
  const [modalVisitorKey, setModalVisitorKey] = useState('');
  const [data, setData] = useState({
    stats: {},
    visitors: [],
    visitorPagination: null,
    summary: { byEventType: {} },
  });

  useEffect(() => {
    fetchTrackingData();
  }, [range, visitorPage]);

  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const params = new URLSearchParams({
        range,
        visitorPage: String(visitorPage),
        visitorPageSize: String(VISITOR_PAGE_SIZE),
      });

      const response = await axios.get(`/api/store/customer-tracking?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setData({
        stats: response.data.stats || {},
        visitors: response.data.visitors || [],
        visitorPagination: response.data.visitorPagination || null,
        summary: response.data.summary || { byEventType: {} },
      });
    } catch (error) {
      console.error('Failed to fetch customer tracking:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Unique Visitors', value: data.stats.uniqueVisitors || 0, icon: Users, tone: 'text-blue-600 bg-blue-50' },
    { label: 'Guest Visitors', value: data.stats.guestVisitors || 0, icon: Eye, tone: 'text-violet-600 bg-violet-50' },
    { label: 'Logged-in Visitors', value: data.stats.loggedInVisitors || 0, icon: UserCheck, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Page Views', value: data.stats.totalPageViews || 0, icon: Activity, tone: 'text-indigo-600 bg-indigo-50' },
    { label: 'Product Views', value: data.stats.totalProductViews || 0, icon: ScrollText, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Clicks', value: data.stats.totalClicks || 0, icon: MousePointerClick, tone: 'text-rose-600 bg-rose-50' },
    { label: 'Avg Time / Visitor', value: formatDuration(data.stats.avgTimeSeconds || 0), icon: Clock3, tone: 'text-slate-700 bg-slate-100' },
  ];

  if (loading && !data.visitors.length) return <Loading />;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Customer Tracking</h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Click any visitor to open a popup with their full journey, time spent, and every tracked action.
          </p>
        </div>

        <select
          value={range}
          onChange={(event) => {
            setVisitorPage(1);
            setRange(event.target.value);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
          <option value="quarter">Last 3 months</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {statCards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
                <p className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">{value}</p>
              </div>
              <div className={`rounded-lg p-2 ${tone}`}>
                <Icon size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-md">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">Visitors</h2>
          <p className="text-xs text-slate-500">Click a row to view full tracking in a popup.</p>
        </div>

        {data.visitorPagination ? (
          <PaginationBar
            page={data.visitorPagination.page}
            totalPages={data.visitorPagination.totalPages}
            start={data.visitorPagination.start}
            end={data.visitorPagination.end}
            total={data.visitorPagination.totalVisitors}
            itemLabel="visitors"
            onPageChange={setVisitorPage}
            className="mx-4 mt-3"
          />
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Visitor</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Pages</th>
                <th className="px-4 py-2.5 font-semibold">Products</th>
                <th className="px-4 py-2.5 font-semibold">Time</th>
                <th className="px-4 py-2.5 font-semibold">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.visitors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    No visitor activity yet for this period.
                  </td>
                </tr>
              ) : (
                data.visitors.map((visitor) => (
                  <tr
                    key={visitor.visitorKey}
                    onClick={() => setModalVisitorKey(visitor.visitorKey)}
                    className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{getVisitorLabel(visitor)}</p>
                        {getVisitorSubtitle(visitor) ? (
                          <p className="mt-0.5 text-[11px] text-slate-500">{getVisitorSubtitle(visitor)}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        visitor.visitorType === 'logged_in'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-violet-100 text-violet-700'
                      }`}>
                        {visitor.visitorType === 'logged_in' ? 'Logged in' : 'Guest'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{visitor.pageViews}</td>
                    <td className="px-4 py-3 text-slate-700">{visitor.productViews?.length || 0}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDuration(visitor.totalTimeSeconds)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(visitor.lastSeen)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data.visitorPagination ? (
          <PaginationBar
            page={data.visitorPagination.page}
            totalPages={data.visitorPagination.totalPages}
            start={data.visitorPagination.start}
            end={data.visitorPagination.end}
            total={data.visitorPagination.totalVisitors}
            itemLabel="visitors"
            onPageChange={setVisitorPage}
            className="mx-4 mb-4 mt-3"
          />
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-md">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">Event Breakdown</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(data.summary.byEventType || {}).map(([eventType, count]) => (
            <div key={eventType} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{eventType}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{count}</p>
            </div>
          ))}
        </div>
      </div>

      <VisitorDetailModal
        open={Boolean(modalVisitorKey)}
        visitorKey={modalVisitorKey}
        range={range}
        getToken={getToken}
        onClose={() => setModalVisitorKey('')}
      />
    </div>
  );
}
