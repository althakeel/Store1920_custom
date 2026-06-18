'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Image from 'next/image';
import {
  Activity,
  ArrowDown,
  Clock3,
  Eye,
  Home,
  MousePointerClick,
  Package,
  Play,
  ScrollText,
  ShoppingBag,
  UserCheck,
  Users,
  X,
  MapPin,
  Mail,
  Phone,
  Fingerprint,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
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
  if (visitor.customerEmail) return visitor.customerEmail.split('@')[0];
  if (visitor.accountId) return `User · ${String(visitor.accountId).slice(0, 8)}`;
  if (visitor.visitorType === 'logged_in') return 'Logged-in visitor';
  return 'Guest';
}

function getVisitorSubtitle(visitor) {
  if (!visitor) return null;
  if (visitor.displaySubtitle) return visitor.displaySubtitle;
  if (visitor.visitorType === 'logged_in') {
    if (visitor.customerEmail) return visitor.customerEmail;
    if (visitor.accountId) return `Account ID · ${String(visitor.accountId).slice(0, 12)}`;
    return 'Signed-in account (no profile saved yet)';
  }
  if (visitor.visitorType === 'guest' && visitor.anonymousId) {
    return `Browser ID · ${String(visitor.anonymousId).slice(0, 10)}`;
  }
  return null;
}

function VisitorIdentityPanel({ visitor }) {
  if (!visitor || visitor.visitorType !== 'logged_in') return null;

  const items = [
    visitor.customerEmail ? { icon: Mail, label: 'Email', value: visitor.customerEmail } : null,
    visitor.customerPhone ? { icon: Phone, label: 'Phone', value: visitor.customerPhone } : null,
    visitor.accountId ? { icon: Fingerprint, label: 'Account ID', value: visitor.accountId } : null,
    visitor.anonymousId ? { icon: Users, label: 'Browser ID', value: visitor.anonymousId } : null,
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <div className="mt-4 rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-indigo-100">
        How to identify this customer
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-2 rounded-xl bg-white/10 px-3 py-2">
            <Icon size={14} className="mt-0.5 shrink-0 text-indigo-100" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-200/90">{label}</p>
              <p className="break-all text-xs font-medium text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>
      {!visitor.hasKnownProfile ? (
        <p className="mt-2 text-[11px] leading-relaxed text-indigo-100/90">
          No name saved yet. Match this visitor using the Account ID above, or check Customers after they place an order.
        </p>
      ) : null}
    </div>
  );
}

function getEventLabel(event) {
  const labels = {
    page_view: 'Page view',
    product_view: 'Product view',
    product_view_ping: 'Viewing product',
    product_view_end: 'Left product',
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

function getEventStyle(eventType) {
  const styles = {
    page_view: { badge: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500', icon: Eye },
    product_view: { badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', icon: Package },
    product_view_ping: { badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400', icon: Package },
    product_view_end: { badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400', icon: Package },
    time_on_page: { badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', icon: Clock3 },
    scroll_depth: { badge: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-500', icon: ArrowDown },
    click: { badge: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500', icon: MousePointerClick },
    session_start: { badge: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500', icon: Play },
    add_to_cart: { badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500', icon: ShoppingBag },
    checkout_start: { badge: 'bg-fuchsia-100 text-fuchsia-800', dot: 'bg-fuchsia-500', icon: ShoppingBag },
    purchase: { badge: 'bg-green-100 text-green-800', dot: 'bg-green-500', icon: Sparkles },
    session_end: { badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400', icon: Clock3 },
  };
  return styles[eventType] || { badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400', icon: Activity };
}

function humanizeSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatPageLabel(path, watchedProducts = []) {
  if (!path || path === '/') return { label: 'Homepage', sub: '/', icon: Home };

  const slugMatch = String(path).match(/\/product\/([^/?#]+)/);
  if (slugMatch) {
    const slug = decodeURIComponent(slugMatch[1]);
    const matched = watchedProducts.find((product) => product.slug === slug);
    return {
      label: matched?.name || humanizeSlug(slug),
      sub: path,
      icon: Package,
    };
  }

  if (path.startsWith('/cart')) return { label: 'Cart', sub: path, icon: ShoppingBag };
  if (path.startsWith('/checkout')) return { label: 'Checkout', sub: path, icon: ShoppingBag };
  if (path.startsWith('/shop')) return { label: 'Shop', sub: path, icon: ShoppingBag };

  return { label: path, sub: null, icon: MapPin };
}

function formatShortDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
  const watchedProducts = visitor?.watchedProducts?.length
    ? visitor.watchedProducts
    : (visitor?.productViews || []).map((name, index) => ({
        id: `${name}-${index}`,
        name,
        slug: null,
        image: null,
      }));

  const statItems = visitor ? [
    { label: 'First seen', value: formatShortDate(visitor.firstSeen), icon: Play, tone: 'from-violet-500 to-indigo-600' },
    { label: 'Last seen', value: formatShortDate(visitor.lastSeen), icon: Clock3, tone: 'from-sky-500 to-blue-600' },
    { label: 'Pages', value: visitor.pageViews, icon: Eye, tone: 'from-emerald-500 to-teal-600' },
    { label: 'Products', value: watchedProducts.length, icon: Package, tone: 'from-amber-500 to-orange-600' },
    { label: 'Total time', value: formatDuration(visitor.totalTimeSeconds), icon: Clock3, tone: 'from-fuchsia-500 to-pink-600' },
    { label: 'Max scroll', value: `${visitor.maxScrollPercent || 0}%`, icon: ArrowDown, tone: 'from-indigo-500 to-purple-600' },
  ] : [];

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[min(94dvh,940px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-200 sm:max-h-[90vh] sm:rounded-3xl">
        {/* shrink-0 keeps flex from crushing the header when body scrolls */}
        <div className="relative shrink-0 overflow-hidden rounded-t-3xl border-b border-violet-500/30 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-4 pb-6 pt-5 sm:rounded-t-3xl sm:px-6 sm:pb-7 sm:pt-6">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/20 text-white shadow-lg backdrop-blur sm:h-14 sm:w-14">
                {visitor?.customerImage ? (
                  <Image
                    src={visitor.customerImage}
                    alt={getVisitorLabel(visitor)}
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                  />
                ) : visitor?.visitorType === 'logged_in' ? (
                  <UserCheck size={24} />
                ) : (
                  <Users size={24} />
                )}
              </div>
              <div className="min-w-0 py-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-bold leading-tight text-white sm:text-xl">
                    {getVisitorLabel(visitor)}
                  </h2>
                  {visitor ? (
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      visitor.visitorType === 'logged_in'
                        ? 'bg-emerald-400/25 text-emerald-50'
                        : 'bg-white/20 text-white'
                    }`}>
                      {visitor.visitorType === 'logged_in' ? 'Logged in' : 'Guest'}
                    </span>
                  ) : null}
                </div>
                {getVisitorSubtitle(visitor) ? (
                  <p className="mt-1 truncate text-xs text-indigo-100">{getVisitorSubtitle(visitor)}</p>
                ) : null}
                <p className="mt-1.5 text-xs leading-relaxed text-indigo-100/90 sm:text-sm">
                  Full journey — pages, products, scroll depth, clicks & time spent
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl bg-white/15 p-2.5 text-white transition hover:bg-white/25"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          <VisitorIdentityPanel visitor={visitor} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/80 px-4 py-4 sm:px-6 sm:py-5">
          {loading && !visitor ? (
            <div className="py-20 text-center text-sm text-slate-500">Loading visitor activity...</div>
          ) : !visitor ? (
            <div className="py-20 text-center text-sm text-slate-500">No tracking data found for this visitor.</div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                {statItems.map(({ label, value, icon: Icon, tone }) => (
                  <div key={label} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className={`h-1 bg-gradient-to-r ${tone}`} />
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                        <Icon size={14} className="text-slate-400" />
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {watchedProducts.length ? (
                <section className="rounded-2xl border border-amber-200/70 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="rounded-lg bg-amber-100 p-1.5 text-amber-700">
                      <Package size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Products watched</p>
                      <p className="text-xs text-slate-500">{watchedProducts.length} product{watchedProducts.length === 1 ? '' : 's'} viewed</p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {watchedProducts.map((product) => (
                      <div
                        key={product.id || product.slug || product.name}
                        className="group flex items-center gap-3 rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-3 transition hover:border-amber-200 hover:shadow-md"
                      >
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-amber-100 ring-1 ring-amber-200/60">
                          {product.image ? (
                            <Image
                              src={product.image}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-amber-600">
                              <Package size={22} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                            {product.name}
                          </p>
                          {product.slug ? (
                            <a
                              href={`/product/${product.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900"
                              onClick={(event) => event.stopPropagation()}
                            >
                              View on store
                              <ExternalLink size={12} />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {visitor.pagesVisited?.length ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="rounded-lg bg-sky-100 p-1.5 text-sky-700">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Browsing path</p>
                      <p className="text-xs text-slate-500">Pages visited in order</p>
                    </div>
                  </div>
                  <div className="relative space-y-0 pl-1">
                    {visitor.pagesVisited.map((page, index) => {
                      const pageInfo = formatPageLabel(page, watchedProducts);
                      const PageIcon = pageInfo.icon;
                      const isLast = index === visitor.pagesVisited.length - 1;

                      return (
                        <div key={`${page}-${index}`} className="relative flex gap-3 pb-4">
                          {!isLast ? (
                            <span className="absolute left-[15px] top-8 h-[calc(100%-12px)] w-0.5 bg-gradient-to-b from-indigo-200 to-transparent" />
                          ) : null}
                          <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-md">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <div className="flex items-start gap-2">
                              <PageIcon size={14} className="mt-0.5 shrink-0 text-indigo-500" />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">{pageInfo.label}</p>
                                {pageInfo.sub ? (
                                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{pageInfo.sub}</p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {visitor.sessions?.length ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-sm font-semibold text-slate-900">Sessions</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {visitor.sessions.map((session) => (
                      <div key={session.sessionKey} className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">
                            Session · {String(session.sessionId || '').slice(0, 8)}
                          </p>
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                            {formatDuration(session.totalTimeSeconds)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {session.pageViews} pages · max scroll {session.maxScrollPercent || 0}%
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="rounded-lg bg-violet-100 p-1.5 text-violet-700">
                    <Activity size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Activity timeline</p>
                    <p className="text-xs text-slate-500">Every tracked action in order</p>
                  </div>
                </div>

                {eventPagination ? (
                  <PaginationBar
                    page={eventPagination.page}
                    totalPages={eventPagination.totalPages}
                    start={eventPagination.start}
                    end={eventPagination.end}
                    total={eventPagination.totalEvents}
                    itemLabel="events"
                    onPageChange={(page) => fetchDetail(page)}
                    className="mb-4 border-violet-100 bg-violet-50/50"
                  />
                ) : null}

                <div className="space-y-3">
                  {(visitor.allEvents || []).map((event) => {
                    const style = getEventStyle(event.eventType);
                    const EventIcon = style.icon;
                    const productName = event.metadata?.productName
                      || (event.metadata?.productSlug ? humanizeSlug(event.metadata.productSlug) : null);

                    return (
                      <div
                        key={`${event.id}-${event.createdAt}`}
                        className="relative rounded-xl border border-slate-200 bg-white p-3 pl-4 shadow-sm"
                      >
                        <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${style.dot}`} />
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${style.badge}`}>
                              <EventIcon size={12} />
                              {getEventLabel(event)}
                            </span>
                            {event.pageType ? (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                {event.pageType.replace(/_/g, ' ')}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] font-medium text-slate-400">{formatShortDate(event.createdAt)}</p>
                        </div>

                        {event.pagePath ? (
                          <p className="mt-2 truncate text-xs text-slate-600">{formatPageLabel(event.pagePath, watchedProducts).label}</p>
                        ) : null}

                        {productName ? (
                          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                            <Package size={12} />
                            {productName}
                          </p>
                        ) : null}

                        {event.metadata?.seconds ? (
                          <p className="mt-1.5 text-xs text-emerald-700">
                            Time on page: {formatDuration(event.metadata.seconds)}
                            {event.metadata.maxScrollPercent ? ` · scrolled to ${event.metadata.maxScrollPercent}%` : ''}
                          </p>
                        ) : null}

                        {event.metadata?.depthPercent ? (
                          <p className="mt-1.5 text-xs text-indigo-700">
                            Scrolled to {event.metadata.depthPercent}%
                            {event.metadata.secondsOnPage
                              ? ` after ${formatDuration(event.metadata.secondsOnPage)}`
                              : ''}
                          </p>
                        ) : null}

                        {event.metadata?.href || event.metadata?.text ? (
                          <p className="mt-1.5 rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-800">
                            <span className="font-semibold">Clicked:</span>{' '}
                            {String(event.metadata.text || event.metadata.href || '').slice(0, 120)}
                            {event.metadata.secondsOnPage
                              ? ` · after ${formatDuration(event.metadata.secondsOnPage)}`
                              : ''}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {loading ? (
                  <p className="mt-4 text-center text-xs text-slate-500">Updating timeline...</p>
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
                    className="mt-4 border-violet-100 bg-violet-50/50"
                  />
                ) : null}
              </section>
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const visitor = params.get('visitor');
    if (visitor) {
      setModalVisitorKey(visitor);
      if (params.get('range')) {
        setRange(params.get('range'));
      }
    }
  }, []);

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
    <div className="space-y-5 sm:space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4 shadow-sm sm:p-5">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-100/60" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Customer Tracking</h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-600 sm:text-sm">
              See who visited your store, what they viewed, and how they interacted. Click any visitor for the full journey.
            </p>
          </div>

          <select
            value={range}
            onChange={(event) => {
              setVisitorPage(1);
              setRange(event.target.value);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="quarter">Last 3 months</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {statCards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
                <p className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">{value}</p>
              </div>
              <div className={`rounded-xl p-2 ${tone}`}>
                <Icon size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">Visitors</h2>
          <p className="text-xs text-slate-500">Click a row to open the full activity popup.</p>
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
                data.visitors.map((visitor) => {
                  const productNames = visitor.productViews?.length
                    ? visitor.productViews
                    : (visitor.watchedProducts || []).map((product) => product.name);

                  return (
                  <tr
                    key={visitor.visitorKey}
                    onClick={() => setModalVisitorKey(visitor.visitorKey)}
                    className="cursor-pointer border-t border-slate-100 transition hover:bg-indigo-50/60"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{getVisitorLabel(visitor)}</p>
                        {getVisitorSubtitle(visitor) ? (
                          <p className="mt-0.5 text-[11px] text-slate-500">{getVisitorSubtitle(visitor)}</p>
                        ) : null}
                        {visitor.visitorType === 'logged_in' && visitor.accountId && !visitor.customerEmail ? (
                          <p className="mt-0.5 font-mono text-[10px] text-violet-600">
                            ID {String(visitor.accountId).slice(0, 12)}
                          </p>
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
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{productNames.length || 0}</p>
                      {productNames.length ? (
                        <p className="mt-0.5 line-clamp-2 max-w-[220px] text-[11px] text-amber-700">
                          {productNames.slice(0, 2).join(' · ')}
                          {productNames.length > 2 ? ` +${productNames.length - 2} more` : ''}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDuration(visitor.totalTimeSeconds)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(visitor.lastSeen)}</td>
                  </tr>
                  );
                })
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">Event Breakdown</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(data.summary.byEventType || {}).map(([eventType, count]) => {
            const style = getEventStyle(eventType);
            return (
            <div key={eventType} className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-2.5">
              <p className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${style.badge}`}>
                {getEventLabel({ eventType })}
              </p>
              <p className="mt-2 text-lg font-bold text-slate-900">{count}</p>
            </div>
            );
          })}
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
