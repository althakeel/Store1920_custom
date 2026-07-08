'use client';

import { useAuth } from '@/lib/useAuth';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import PageSkeleton from '@/components/PageSkeleton';
import { getProductThumbnailUrl, normalizeProductImages } from '@/lib/productMedia';
import { PLACEHOLDER_IMAGE } from '@/lib/mediaUrls';
import axios from 'axios';
import {
  StarIcon,
  Search,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Clock3,
  Package,
  Plus,
  X,
  ImageIcon,
  Video,
  CheckCircle2,
  XCircle,
  Trash2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function getTodayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultFormData() {
  return {
    customerName: '',
    customerEmail: '',
    rating: 5,
    review: '',
    images: [],
    videos: [],
    reviewDate: getTodayDateInputValue(),
  };
}

function getReviewProductImageSrc(product) {
  const mergedImages = [
    ...normalizeProductImages(product?.images),
    ...normalizeProductImages(product?.externalImages),
  ];

  const thumbnail = getProductThumbnailUrl(
    { ...product, images: mergedImages },
    { fallback: PLACEHOLDER_IMAGE }
  );

  const src = String(thumbnail || '').trim();
  if (!src || src === PLACEHOLDER_IMAGE) return '';
  if (/^(https?:)?\/\//i.test(src) || src.startsWith('/')) return src;
  return '';
}

function ProductThumb({ product, size = 64 }) {
  const [failed, setFailed] = useState(false);
  const imageSrc = getReviewProductImageSrc(product);

  if (!imageSrc || failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300"
        style={{ width: size, height: size }}
      >
        <Package size={Math.max(18, Math.round(size * 0.34))} />
      </div>
    );
  }

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
      style={{ width: size, height: size }}
    >
      <Image
        src={imageSrc}
        alt={product?.name || 'Product'}
        fill
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function getReviewId(review) {
  return String(review?._id || review?.id || '');
}

function StarRow({ value, size = 14 }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, index) => (
        <StarIcon
          key={index}
          size={size}
          fill={value >= index + 1 ? '#F59E0B' : '#E2E8F0'}
          className="text-transparent"
        />
      ))}
    </div>
  );
}

function ReviewCard({ review, onApprove, onReject, onDelete, deleting }) {
  const reviewId = getReviewId(review);
  const customerName = review.user?.name || review.customerName || 'Customer';
  const initials = customerName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {review.user?.image && review.user.image !== '/placeholder-avatar.png' ? (
          <Image
            src={review.user.image}
            alt={customerName}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-100"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 ring-2 ring-slate-100">
            {initials || '?'}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{customerName}</span>
            <StarRow value={Number(review.rating || 0)} />
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                review.approved
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {review.approved ? 'Approved' : 'Pending'}
            </span>
          </div>

          {review.user?.email || review.customerEmail ? (
            <p className="mt-0.5 text-xs text-slate-500">{review.user?.email || review.customerEmail}</p>
          ) : null}

          <p className="mt-2 text-sm leading-relaxed text-slate-700">{review.review}</p>

          {review.images?.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {review.images.map((img, idx) => (
                <Image
                  key={`${reviewId}-img-${idx}`}
                  src={img}
                  alt="Review image"
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] rounded-lg border border-slate-200 object-cover"
                />
              ))}
            </div>
          ) : null}

          {review.videos?.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {review.videos.map((video, idx) => (
                <video
                  key={`${reviewId}-vid-${idx}`}
                  src={video}
                  controls
                  className="h-24 w-40 rounded-lg border border-slate-200 object-cover"
                />
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">
              {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : '—'}
            </span>
            {!review.approved ? (
              <>
                <button
                  type="button"
                  onClick={() => onApprove(reviewId)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  <CheckCircle2 size={12} />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => onReject(reviewId)}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                >
                  <XCircle size={12} />
                  Reject
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => onDelete(reviewId)}
              disabled={deleting}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={12} />
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductReviewRow({
  product,
  expanded,
  reviews,
  reviewsLoading,
  onToggle,
  onAddReview,
  onApprove,
  onReject,
  onDelete,
  deletingReviewId,
}) {
  const summary = product.reviewSummary || { count: 0, pendingCount: 0, averageRating: 0 };
  const pendingCount = summary.pendingCount || 0;
  const reviewCount = summary.count || 0;
  const averageRating = summary.averageRating || 0;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex w-full items-center gap-4 p-4 sm:p-5">
        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onToggle();
            }
          }}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 text-left transition hover:opacity-90"
        >
          <ProductThumb product={product} size={64} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-slate-900">{product.name}</h3>
              {pendingCount > 0 ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  {pendingCount} pending
                </span>
              ) : null}
            </div>
            {product.sku ? <p className="mt-0.5 text-xs text-slate-500">SKU: {product.sku}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {reviewCount > 0 ? (
                <>
                  <StarRow value={Math.round(averageRating)} size={13} />
                  <span className="text-xs font-medium text-slate-600">
                    {averageRating.toFixed(1)} · {reviewCount} review{reviewCount !== 1 ? 's' : ''}
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400">No reviews yet</span>
              )}
            </div>
          </div>

          <div className="hidden shrink-0 sm:block">
            {expanded ? (
              <ChevronUp size={18} className="text-slate-400" />
            ) : (
              <ChevronDown size={18} className="text-slate-400" />
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onAddReview(product)}
            className="hidden items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 sm:inline-flex"
          >
            <Plus size={14} />
            Add review
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? 'Collapse reviews' : 'Expand reviews'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 sm:hidden"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-3 sm:hidden">
            <p className="text-sm font-semibold text-slate-700">Reviews</p>
            <button
              type="button"
              onClick={() => onAddReview(product)}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Plus size={14} />
              Add
            </button>
          </div>

          {reviewsLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Loading reviews...
            </div>
          ) : (reviews || []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
              <MessageSquare className="mx-auto mb-2 text-slate-300" size={24} />
              <p className="text-sm font-medium text-slate-700">No reviews yet</p>
              <p className="mt-1 text-xs text-slate-500">Add the first review for this product.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(reviews || []).map((review) => (
                <ReviewCard
                  key={getReviewId(review)}
                  review={review}
                  onApprove={onApprove}
                  onReject={onReject}
                  onDelete={onDelete}
                  deleting={deletingReviewId === getReviewId(review)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function StoreReviews() {
  const { getToken, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({
    totalReviews: 0,
    averageRating: 0,
    pendingReviews: 0,
    withReviews: 0,
    noReviews: 0,
    totalProducts: 0,
  });
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    withReviews: 0,
    noReviews: 0,
    pending: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    totalProducts: 0,
    totalPages: 1,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [expandedReviews, setExpandedReviews] = useState({});
  const [reviewsLoadingId, setReviewsLoadingId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(getDefaultFormData);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [videoPreviews, setVideoPreviews] = useState([]);
  const [deletingReviewId, setDeletingReviewId] = useState(null);
  const hasLoadedRef = useRef(false);

  const fetchProductReviews = useCallback(async (productId) => {
    setReviewsLoadingId(productId);
    try {
      const token = await getToken();
      const { data } = await axios.get('/api/store/reviews', {
        params: { productId },
        headers: { Authorization: `Bearer ${token}` },
      });
      setExpandedReviews((current) => ({
        ...current,
        [productId]: data.reviews || [],
      }));
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    } finally {
      setReviewsLoadingId(null);
    }
  }, [getToken]);

  const fetchReviews = useCallback(async (page, { initial = false } = {}) => {
    if (initial) setLoading(true);
    else setListLoading(true);

    try {
      const token = await getToken();
      const { data } = await axios.get('/api/store/reviews', {
        params: {
          page,
          limit: 15,
          search: debouncedSearch || undefined,
          filter: filterStatus !== 'all' ? filterStatus : undefined,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      setProducts(data.products || []);
      setStats(data.stats || {});
      setFilterCounts(data.filterCounts || {});
      setPagination({
        page: data.pagination?.page || page,
        limit: data.pagination?.limit || 15,
        totalProducts: data.pagination?.totalProducts || 0,
        totalPages: data.pagination?.totalPages || 1,
      });
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    } finally {
      setLoading(false);
      setListLoading(false);
    }
  }, [debouncedSearch, filterStatus, getToken]);

  const refreshExpandedProduct = useCallback(async (productId) => {
    if (!productId) return;
    await fetchProductReviews(productId);
  }, [fetchProductReviews]);

  const handleToggleProduct = useCallback(async (productId) => {
    if (expandedProductId === productId) {
      setExpandedProductId(null);
      return;
    }

    setExpandedProductId(productId);
    if (!expandedReviews[productId]) {
      await fetchProductReviews(productId);
    }
  }, [expandedProductId, expandedReviews, fetchProductReviews]);

  const handleApproval = async (reviewId, approved) => {
    try {
      const token = await getToken();
      await axios.post(
        '/api/store/reviews/approve',
        { reviewId, approved },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(approved ? 'Review approved' : 'Review rejected');
      await fetchReviews(pagination.page);
      if (expandedProductId) {
        await refreshExpandedProduct(expandedProductId);
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Delete this review permanently? This cannot be undone.')) {
      return;
    }

    setDeletingReviewId(reviewId);
    try {
      const token = await getToken();
      await axios.delete('/api/store/reviews', {
        data: { reviewId },
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Review deleted');
      await fetchReviews(pagination.page);
      if (expandedProductId) {
        await refreshExpandedProduct(expandedProductId);
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    } finally {
      setDeletingReviewId(null);
    }
  };

  const resetFormFields = () => {
    setFormData(getDefaultFormData());
    setImagePreviews([]);
    setVideoPreviews([]);
  };

  const resetForm = () => {
    resetFormFields();
    setSelectedProduct(null);
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const token = await getToken();
      const form = new FormData();
      form.append('productId', selectedProduct._id);
      form.append('rating', formData.rating);
      form.append('review', formData.review);
      form.append('customerName', formData.customerName);
      form.append('customerEmail', formData.customerEmail);
      if (formData.reviewDate) {
        form.append('reviewDate', formData.reviewDate);
      }

      formData.images.forEach((image) => form.append('images', image));
      formData.videos.forEach((video) => form.append('videos', video));

      await axios.post('/api/store/reviews', form, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success('Review added successfully');
      setShowAddModal(false);
      resetForm();
      await fetchReviews(pagination.page);
      if (selectedProduct?._id) {
        setExpandedProductId(selectedProduct._id);
        await refreshExpandedProduct(selectedProduct._id);
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPagination((current) => ({ ...current, page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!user) return;
    setExpandedProductId(null);
    fetchReviews(pagination.page, { initial: !hasLoadedRef.current });
    hasLoadedRef.current = true;
  }, [user, debouncedSearch, filterStatus, pagination.page, fetchReviews]);

  const filters = useMemo(() => ([
    { id: 'all', label: 'All products', count: filterCounts.all || 0 },
    { id: 'with-reviews', label: 'With reviews', count: filterCounts.withReviews || 0 },
    { id: 'no-reviews', label: 'No reviews', count: filterCounts.noReviews || 0 },
    { id: 'pending', label: 'Pending approval', count: filterCounts.pending || 0 },
  ]), [filterCounts]);

  const paginationWindowStart = Math.max(1, pagination.page - 2);
  const paginationWindowEnd = Math.min(pagination.totalPages, paginationWindowStart + 4);
  const visiblePageNumbers = [];
  for (let page = Math.max(1, paginationWindowEnd - 4); page <= paginationWindowEnd; page += 1) {
    visiblePageNumbers.push(page);
  }

  const showingFrom = pagination.totalProducts === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const showingTo = Math.min(pagination.page * pagination.limit, pagination.totalProducts);

  if (loading && !products.length) return <PageSkeleton rows={8} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Product Reviews</h1>
        <p className="mt-1 text-xs text-slate-600 sm:text-sm">
          Moderate customer feedback, approve pending reviews, and add testimonials for your products.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <MessageSquare size={14} />
            Total reviews
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.totalReviews}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            <StarIcon size={14} />
            Average rating
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-800">
            {stats.totalReviews ? stats.averageRating.toFixed(1) : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
            <Clock3 size={14} />
            Pending approval
          </div>
          <p className="mt-2 text-2xl font-bold text-violet-800">{stats.pendingReviews}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <Package size={14} />
            Products reviewed
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.withReviews}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <p className="text-xs text-slate-500 lg:shrink-0">
            Showing <span className="font-semibold text-slate-700">{showingFrom}-{showingTo}</span> of{' '}
            <span className="font-semibold text-slate-700">{pagination.totalProducts}</span> products
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setExpandedProductId(null);
                setExpandedReviews({});
                setFilterStatus(item.id);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                filterStatus === item.id
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>
      </div>

      {listLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          Updating product list...
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <Search className="mx-auto mb-3 text-slate-300" size={32} />
          <p className="text-sm font-semibold text-slate-700">No products found</p>
          <p className="mt-1 text-xs text-slate-500">
            {searchQuery
              ? `Nothing matches "${searchQuery}". Try another search term.`
              : 'No products match the selected filter.'}
          </p>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Clear search
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <ProductReviewRow
              key={product._id || product.id}
              product={product}
              expanded={expandedProductId === product._id}
              reviews={expandedReviews[product._id] || []}
              reviewsLoading={reviewsLoadingId === product._id}
              onToggle={() => handleToggleProduct(product._id)}
              onAddReview={(entry) => {
                resetFormFields();
                setSelectedProduct(entry);
                setShowAddModal(true);
              }}
              onApprove={(reviewId) => handleApproval(reviewId, true)}
              onReject={(reviewId) => handleApproval(reviewId, false)}
              onDelete={handleDeleteReview}
              deletingReviewId={deletingReviewId}
            />
          ))}
        </div>
      )}

      {pagination.totalPages > 1 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || listLoading}
              onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            {visiblePageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                disabled={listLoading}
                onClick={() => setPagination((current) => ({ ...current, page: pageNumber }))}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  pagination.page === pageNumber
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || listLoading}
              onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {showAddModal && selectedProduct ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <form
            onSubmit={handleSubmitReview}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
          >
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <ProductThumb product={selectedProduct} size={56} />
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-white/70">Add review</p>
                    <h2 className="truncate text-lg font-bold">{selectedProduct.name}</h2>
                    {selectedProduct.sku ? (
                      <p className="text-xs text-white/70">SKU: {selectedProduct.sku}</p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Customer name *</label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(event) => setFormData({ ...formData, customerName: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Customer email *</label>
                  <input
                    type="email"
                    required
                    value={formData.customerEmail}
                    onChange={(event) => setFormData({ ...formData, customerEmail: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Rating *</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className="rounded-lg p-1 transition hover:bg-amber-50"
                    >
                      <StarIcon
                        size={28}
                        fill={formData.rating >= star ? '#F59E0B' : '#E2E8F0'}
                        className="text-transparent"
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Review date</label>
                <input
                  type="date"
                  value={formData.reviewDate}
                  max={getTodayDateInputValue()}
                  onChange={(event) => setFormData({ ...formData, reviewDate: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200 sm:max-w-xs"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Defaults to today. Change this if the review was written on an earlier date.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Review *</label>
                <textarea
                  required
                  value={formData.review}
                  onChange={(event) => setFormData({ ...formData, review: event.target.value })}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Share what the customer liked about this product..."
                />
              </div>

              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <ImageIcon size={15} />
                  Images (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    const remainingSlots = 5 - formData.images.length;
                    if (remainingSlots <= 0) {
                      toast.error('Maximum 5 images allowed');
                      event.target.value = '';
                      return;
                    }
                    const filesToAdd = files.slice(0, remainingSlots);
                    if (files.length > remainingSlots) {
                      toast.error(`Only ${remainingSlots} more image${remainingSlots !== 1 ? 's' : ''} can be added`);
                    }
                    setFormData({ ...formData, images: [...formData.images, ...filesToAdd] });
                    setImagePreviews([
                      ...imagePreviews,
                      ...filesToAdd.map((file) => URL.createObjectURL(file)),
                    ]);
                    event.target.value = '';
                  }}
                  className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                  disabled={formData.images.length >= 5}
                />
                <p className="mt-1 text-xs text-slate-500">{formData.images.length}/5 images</p>
                {imagePreviews.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {imagePreviews.map((preview, idx) => (
                      <div key={preview} className="relative">
                        <Image
                          src={preview}
                          alt={`Preview ${idx + 1}`}
                          width={88}
                          height={88}
                          className="h-[88px] w-[88px] rounded-xl border border-slate-200 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              images: formData.images.filter((_, index) => index !== idx),
                            });
                            setImagePreviews(imagePreviews.filter((_, index) => index !== idx));
                          }}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Video size={15} />
                  Videos (optional)
                </label>
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    setFormData({ ...formData, videos: [...formData.videos, ...files] });
                    setVideoPreviews([
                      ...videoPreviews,
                      ...files.map((file) => URL.createObjectURL(file)),
                    ]);
                  }}
                  className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                />
                {videoPreviews.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {videoPreviews.map((preview, idx) => (
                      <div key={preview} className="relative">
                        <video
                          src={preview}
                          controls
                          className="h-24 w-40 rounded-xl border border-slate-200 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              videos: formData.videos.filter((_, index) => index !== idx),
                            });
                            setVideoPreviews(videoPreviews.filter((_, index) => index !== idx));
                          }}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit review'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
