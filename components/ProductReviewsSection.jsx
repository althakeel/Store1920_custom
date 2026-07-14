'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import axios from 'axios';
import { StarIcon, ChevronLeft, ChevronRight, ThumbsUp, BadgeCheck, X } from 'lucide-react';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';
import { useAuth } from '@/lib/useAuth';
import { getProductPath } from '@/lib/productUrl';
import ReviewForm from '@/components/ReviewForm';

const REVIEWS_PREVIEW_COUNT = 3;

const HELPFUL_VOTER_KEY = 'store1920_helpful_voter';
const NOON_GREEN = '#38ae04';
const NOON_GREEN_LIGHT = '#86efac';

function getHelpfulVoterId() {
  if (typeof window === 'undefined') return '';
  try {
    let id = window.localStorage.getItem(HELPFUL_VOTER_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `voter_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(HELPFUL_VOTER_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

function hasVotedHelpfulLocally(reviewId) {
  if (typeof window === 'undefined' || !reviewId) return false;
  try {
    return window.localStorage.getItem(`helpful_review_${reviewId}`) === '1';
  } catch {
    return false;
  }
}

function markVotedHelpfulLocally(reviewId) {
  if (typeof window === 'undefined' || !reviewId) return;
  try {
    window.localStorage.setItem(`helpful_review_${reviewId}`, '1');
  } catch {
    // ignore
  }
}

const formatReviewDate = (dateString, locale = 'en-US') => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
};

const maskReviewerName = (name, guestLabel = 'Guest User') => {
  const safeName = (name || guestLabel).trim();
  if (safeName.length <= 2) return `${safeName[0] || 'U'}***`;
  if (safeName.length <= 5) return `${safeName.slice(0, 2)}***`;
  return `${safeName.slice(0, 3)}***${safeName.slice(-1)}`;
};

function StarRow({ rating, size = 16, filledColor = NOON_GREEN, emptyColor = '#d1d5db' }) {
  const value = Number(rating) || 0;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => {
        const remaining = value - index;
        const filled = remaining >= 1;
        const half = !filled && remaining >= 0.5;
        return (
          <StarIcon
            key={index}
            size={size}
            className="text-transparent"
            fill={filled ? filledColor : half ? NOON_GREEN_LIGHT : emptyColor}
            strokeWidth={1.5}
          />
        );
      })}
    </div>
  );
}

function RatingBar({ stars, count, total, barClassName, isArabic }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="grid grid-cols-[40px_1fr_36px] items-center gap-2 text-[13px] text-gray-800">
      <span className="font-medium">{stars} <span className="text-[#38ae04]">★</span></span>
      <div className="h-[6px] rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${percentage}%` }} />
      </div>
      <span className={`text-gray-600 text-[12px] ${isArabic ? 'text-left' : 'text-right'}`}>{percentage}%</span>
    </div>
  );
}

function WriteReviewModal({ open, onClose, productId, t, onReviewSubmitted }) {
  const { user, getToken } = useAuth();
  const pathname = usePathname();
  const [access, setAccess] = useState({
    loading: true,
    signedIn: false,
    canReview: false,
    alreadyReviewed: false,
    reviewPending: false,
    awaitingDelivery: false,
    hasPurchased: false,
  });

  useEffect(() => {
    if (!open || !productId) return undefined;

    let cancelled = false;
    (async () => {
      setAccess((prev) => ({ ...prev, loading: true }));
      try {
        const token = await getToken?.();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const { data } = await axios.get(
          `/api/review/can-review?productId=${encodeURIComponent(productId)}`,
          { headers },
        );
        if (cancelled) return;
        setAccess({
          loading: false,
          signedIn: Boolean(data?.signedIn),
          canReview: Boolean(data?.canReview),
          alreadyReviewed: Boolean(data?.alreadyReviewed),
          reviewPending: Boolean(data?.reviewPending),
          awaitingDelivery: Boolean(data?.awaitingDelivery),
          hasPurchased: Boolean(data?.hasPurchased),
        });
      } catch {
        if (!cancelled) {
          setAccess({
            loading: false,
            signedIn: false,
            canReview: false,
            alreadyReviewed: false,
            reviewPending: false,
            awaitingDelivery: false,
            hasPurchased: false,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, productId, user?.uid, getToken]);

  const handleReviewAdded = () => {
    onReviewSubmitted?.();
    setAccess((prev) => ({
      ...prev,
      canReview: false,
      alreadyReviewed: false,
      reviewPending: true,
    }));
    onClose?.();
  };

  if (!open) return null;

  const showReviewForm = access.signedIn && !access.alreadyReviewed && !access.reviewPending;
  const statusMessage = access.canReview
    ? ''
    : access.awaitingDelivery
      ? t('reviews.awaitingDelivery')
      : t('reviews.purchaseRequired');

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="write-review-modal-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-2.5 pe-10 text-[16px] font-semibold text-gray-900">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400">
            <StarIcon size={11} fill="#fff" className="text-white" />
          </span>
          <div>
            <h3 id="write-review-modal-title">{t('reviews.writeReview')}</h3>
            <p className="mt-1 text-[13px] font-normal leading-5 text-gray-600">
              {t('reviews.howToReviewBody')}
            </p>
          </div>
        </div>

        <div className="mt-5">
          {access.loading ? (
            <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
          ) : !access.signedIn ? (
            <div className="space-y-3">
              <p className="text-[13px] leading-6 text-gray-600">
                {t('reviews.signInToReview')}
              </p>
              <Link
                href={`/sign-in?redirect_to=${encodeURIComponent(pathname || '/')}`}
                className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                {t('navbar.signInRegister')}
              </Link>
            </div>
          ) : access.reviewPending ? (
            <p className="text-[13px] leading-6 text-amber-800">{t('reviews.reviewPending')}</p>
          ) : access.alreadyReviewed ? (
            <p className="text-[13px] leading-6 text-gray-600">{t('reviews.alreadyReviewed')}</p>
          ) : showReviewForm ? (
            <ReviewForm
              productId={productId}
              onReviewAdded={handleReviewAdded}
              onCancel={onClose}
              startOpen
              submitDisabled={!access.canReview}
              statusMessage={access.canReview ? '' : statusMessage}
            />
          ) : (
            <p className="text-[13px] leading-6 text-gray-600">{t('reviews.purchaseRequired')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewCard({
  review,
  product,
  onImageClick,
  onHelpfulVote,
  t,
  isArabic,
  dateLocale,
  guestLabel,
}) {
  const [expanded, setExpanded] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(Number(review.helpfulCount || 0));
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const reviewId = String(review._id || review.id || '');

  useEffect(() => {
    setHelpfulCount(Number(review.helpfulCount || 0));
  }, [review.helpfulCount]);

  useEffect(() => {
    setHasVoted(hasVotedHelpfulLocally(reviewId));
  }, [reviewId]);

  const handleHelpfulClick = async () => {
    if (!reviewId || voting || hasVoted) return;
    const voterId = getHelpfulVoterId();
    if (!voterId) return;

    setVoting(true);
    try {
      const { data } = await axios.post('/api/review/helpful', { reviewId, voterId });
      const nextCount = Number(data?.helpfulCount ?? helpfulCount);
      setHelpfulCount(nextCount);
      setHasVoted(true);
      markVotedHelpfulLocally(reviewId);
      onHelpfulVote?.(reviewId, nextCount);
    } catch (error) {
      console.error('Failed to mark review helpful:', error);
    } finally {
      setVoting(false);
    }
  };

  const helpfulLabel = helpfulCount > 0
    ? t('reviews.helpfulCount', { count: helpfulCount })
    : t('reviews.helpful');
  const reviewerName = review.user?.name || review.userId?.name || review.customerName || guestLabel;
  const reviewText = String(review.review || review.comment || '').trim();
  const shouldTruncate = reviewText.length > 260;
  const truncatedText = shouldTruncate ? `${reviewText.slice(0, 260).trim()} ` : reviewText;
  const reviewTitle = (() => {
    if (!reviewText) return product?.name || '';
    const firstSentence = reviewText.split(/(?<=[.!?])\s+/)[0]?.trim();
    if (firstSentence && firstSentence.length <= 120) return firstSentence;
    return reviewText.length > 90 ? `${reviewText.slice(0, 90).trim()}...` : reviewText;
  })();

  const productPath = getProductPath(product);
  const productName = String(product?.name || '').trim();
  const reviewImages = Array.isArray(review.images) ? review.images.filter(Boolean) : [];
  const productThumb = reviewImages[0]
    || (Array.isArray(product?.images) && product.images[0] ? product.images[0] : null);

  return (
    <article className="border-b border-gray-200 py-6 last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-sm font-semibold text-gray-500">
          {reviewerName[0]?.toUpperCase() || '?'}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[14px] font-semibold text-gray-900">
              {maskReviewerName(reviewerName, guestLabel)}
            </span>
            {review.orderId ? (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-900">
                <BadgeCheck size={14} className="text-gray-800" strokeWidth={2.25} />
                {t('reviews.verifiedPurchase')}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[13px] text-gray-600">{formatReviewDate(review.createdAt, dateLocale)}</p>

          <div className="mt-2">
            <StarRow rating={review.rating || 0} size={16} />
          </div>

          {reviewImages.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {reviewImages.map((img, imageIdx) => (
                <button
                  key={`${review._id || review.id}-img-${imageIdx}`}
                  type="button"
                  onClick={() => onImageClick?.(img)}
                  className="relative h-[72px] w-[72px] overflow-hidden rounded border border-gray-200 bg-white"
                >
                  <Image src={img} alt={`Review photo ${imageIdx + 1}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          {(productName || productThumb) ? (
            <div className="mt-3 flex items-start gap-3">
              {productThumb ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-gray-200 bg-white">
                  <Image src={productThumb} alt="" fill className="object-cover" />
                </div>
              ) : null}
              <p className="text-[12px] leading-5 text-gray-500">
                {productName ? (
                  <>
                    {t('reviews.productLabel', { name: productName })}
                    {' | '}
                  </>
                ) : null}
                <Link href={productPath} className="font-medium text-blue-600 hover:underline">
                  {t('reviews.viewProduct')}
                </Link>
              </p>
            </div>
          ) : null}

          {reviewTitle ? (
            <h4 className="mt-3 text-[15px] font-semibold leading-6 text-gray-900">{reviewTitle}</h4>
          ) : null}

          {reviewText ? (
            <div className="mt-1 text-[14px] leading-7 text-gray-800" dir="auto">
              {expanded || !shouldTruncate ? (
                <p>{reviewText}</p>
              ) : (
                <p>
                  {truncatedText}
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    {t('reviews.more')}
                  </button>
                </p>
              )}
              {expanded && shouldTruncate ? (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="mt-1 text-[13px] font-semibold text-blue-600 hover:underline"
                >
                  {t('reviews.less')}
                </button>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleHelpfulClick}
            disabled={voting || hasVoted || !reviewId}
            className={`mt-4 inline-flex min-w-[120px] items-center justify-center gap-2 rounded-md border px-4 py-2 text-[13px] font-medium transition ${
              hasVoted
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            } disabled:cursor-default`}
          >
            <ThumbsUp size={14} />
            {helpfulLabel}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function ProductReviewsSection({
  product,
  reviews = [],
  loading = false,
  initialVisibleCount = REVIEWS_PREVIEW_COUNT,
  compactMobile = false,
  sectionId = 'product-reviews',
}) {
  const { t, isArabic } = useStorefrontI18n();
  const [starFilter, setStarFilter] = useState('all');
  const [sortBy, setSortBy] = useState('top');
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [photoScrollRef, setPhotoScrollRef] = useState(null);
  const [reviewItems, setReviewItems] = useState(reviews);

  useEffect(() => {
    setReviewItems(reviews);
  }, [reviews]);

  useEffect(() => {
    const productId = String(product?._id || product?.id || '').trim();
    if (!productId) return undefined;

    const needsHelpfulRefresh = reviews.some(
      (review) => review.helpfulCount === undefined || review.helpfulCount === null
    );
    if (!needsHelpfulRefresh) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`/api/review?productId=${productId}`);
        if (cancelled || !Array.isArray(data?.reviews)) return;
        setReviewItems(data.reviews);
      } catch {
        // Keep SSR reviews if refresh fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [product?._id, product?.id, reviews]);

  const handleHelpfulVote = (reviewId, helpfulCount) => {
    setReviewItems((prev) => prev.map((item) => (
      String(item._id || item.id) === String(reviewId)
        ? { ...item, helpfulCount }
        : item
    )));
  };

  const handleReviewSubmitted = async () => {
    const productId = String(product?._id || product?.id || '').trim();
    if (!productId) return;
    try {
      const { data } = await axios.get(`/api/review?productId=${productId}`);
      if (Array.isArray(data?.reviews)) setReviewItems(data.reviews);
    } catch {
      // Keep current list if refresh fails.
    }
  };

  useEffect(() => {
    setShowAllReviews(false);
  }, [starFilter, sortBy]);

  const dateLocale = isArabic ? 'ar-AE' : 'en-US';
  const guestLabel = t('reviews.guestUser');
  const getRatingLabel = (count) => (
    count === 1 ? t('product.ratingSingular') : t('product.ratingPlural')
  );

  const reviewCount = reviewItems.length;
  const averageRating = reviewCount > 0
    ? reviewItems.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / reviewCount
    : 0;

  const ratingBreakdown = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviewItems.forEach((review) => {
      const stars = Math.round(Number(review.rating) || 0);
      if (stars >= 1 && stars <= 5) counts[stars] += 1;
    });
    return counts;
  }, [reviewItems]);

  const customerPhotos = useMemo(() => (
    reviewItems.flatMap((review) => (Array.isArray(review.images) ? review.images : [])).filter(Boolean)
  ), [reviewItems]);

  const filteredReviews = useMemo(() => {
    let next = [...reviewItems];

    if (starFilter !== 'all') {
      const target = Number(starFilter);
      next = next.filter((review) => Math.round(Number(review.rating) || 0) === target);
    }

    if (sortBy === 'recent') {
      next.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sortBy === 'lowest') {
      next.sort((a, b) => (Number(a.rating) || 0) - (Number(b.rating) || 0));
    } else {
      next.sort((a, b) => {
        const ratingDiff = (Number(b.rating) || 0) - (Number(a.rating) || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    }

    return next;
  }, [reviewItems, sortBy, starFilter]);

  const visibleReviews = showAllReviews ? filteredReviews : filteredReviews.slice(0, initialVisibleCount);

  const scrollPhotos = (direction) => {
    if (!photoScrollRef) return;
    const scrollAmount = direction * 220;
    photoScrollRef.scrollBy({ left: isArabic ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  const starOptionLabel = (value) => {
    if (value === 'all') return t('reviews.allStars');
    if (value === 1) return t('reviews.oneStar');
    return t('reviews.starsCount', { count: value });
  };

  const productId = String(product?._id || product?.id || '').trim();

  const sidebar = (
    <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
      <div>
        <div className="flex items-end gap-3">
          <span className="text-[44px] font-semibold leading-none tracking-tight text-gray-900">
            {averageRating.toFixed(1)}
          </span>
          <StarRow rating={averageRating} size={20} />
        </div>
        <p className="mt-2 text-[13px] text-gray-600">
          {t('reviews.basedOn', { count: reviewCount, label: getRatingLabel(reviewCount) })}
        </p>
      </div>

      <div className="space-y-2.5">
        <RatingBar stars={5} count={ratingBreakdown[5]} total={reviewCount} barClassName="bg-[#38ae04]" isArabic={isArabic} />
        <RatingBar stars={4} count={ratingBreakdown[4]} total={reviewCount} barClassName="bg-[#4ade80]" isArabic={isArabic} />
        <RatingBar stars={3} count={ratingBreakdown[3]} total={reviewCount} barClassName="bg-amber-400" isArabic={isArabic} />
        <RatingBar stars={2} count={ratingBreakdown[2]} total={reviewCount} barClassName="bg-orange-400" isArabic={isArabic} />
        <RatingBar stars={1} count={ratingBreakdown[1]} total={reviewCount} barClassName="bg-orange-500" isArabic={isArabic} />
      </div>
    </aside>
  );

  return (
    <section
      id={sectionId}
      className={compactMobile ? 'border-t border-gray-100 bg-white pt-4' : 'border-t border-gray-200 bg-white pt-8'}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 ${compactMobile ? '' : ''}`}>
        <h2 className={`font-semibold text-gray-900 ${compactMobile ? 'text-[18px]' : 'text-[22px] sm:text-[24px]'}`}>
          {t('reviews.title')}
        </h2>
        <button
          type="button"
          onClick={() => setReviewModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
        >
          <StarIcon size={15} className="text-orange-500" fill="currentColor" />
          {t('reviews.writeReview')}
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-xl bg-gray-100" />
          <div className="h-40 rounded-xl bg-gray-100" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
          {sidebar}

          <div className="min-w-0">
            {reviewCount === 0 ? (
              <div className={`rounded-lg border border-gray-200 bg-gray-50 text-center ${compactMobile ? 'p-5' : 'p-8'}`}>
                <p className="text-lg font-semibold text-gray-900">{t('reviews.noReviewsTitle')}</p>
                <p className="mt-2 text-sm text-gray-600">{t('reviews.noReviewsBody')}</p>
              </div>
            ) : (
              <>
            <div className="mb-5 flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-[18px] font-semibold text-gray-900">{t('reviews.heading')}</h3>
              <div className="flex flex-wrap items-center gap-4 text-[12px] text-gray-700">
                <label className="inline-flex items-center gap-2">
                  <span className="font-bold uppercase tracking-wide text-gray-800">{t('reviews.filterBy')}</span>
                  <select
                    value={starFilter}
                    onChange={(event) => setStarFilter(event.target.value)}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-[13px] text-gray-800"
                  >
                    {['all', '5', '4', '3', '2', '1'].map((value) => (
                      <option key={value} value={value}>
                        {starOptionLabel(value === 'all' ? 'all' : Number(value))}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex items-center gap-2">
                  <span className="font-bold uppercase tracking-wide text-gray-800">{t('reviews.sortBy')}</span>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-[13px] text-gray-800"
                  >
                    <option value="top">{t('reviews.topReviews')}</option>
                    <option value="recent">{t('reviews.mostRecent')}</option>
                    <option value="lowest">{t('reviews.lowestRating')}</option>
                  </select>
                </label>
              </div>
            </div>

            {customerPhotos.length > 0 ? (
              <div className="mb-6 border-b border-gray-100 pb-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-[15px] font-semibold text-gray-900">
                    {t('reviews.customerPhotos', { count: customerPhotos.length })}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setLightboxImage(customerPhotos[0])}
                    className="text-[13px] font-medium text-blue-600 hover:underline"
                  >
                    {t('reviews.viewAll')}
                  </button>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => scrollPhotos(-1)}
                    className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-1.5 shadow-sm ${isArabic ? 'right-0' : 'left-0'}`}
                    aria-label={t('reviews.scrollPhotosLeft')}
                  >
                    <ChevronLeft size={16} className={isArabic ? 'rotate-180' : ''} />
                  </button>
                  <div
                    ref={setPhotoScrollRef}
                    className="flex gap-2 overflow-x-auto scroll-smooth px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {customerPhotos.slice(0, 12).map((photo, index) => (
                      <button
                        key={`${photo}-${index}`}
                        type="button"
                        onClick={() => setLightboxImage(photo)}
                        className="relative h-20 w-20 shrink-0 overflow-hidden rounded border border-gray-200 bg-white"
                      >
                        <Image src={photo} alt={`Customer photo ${index + 1}`} fill className="object-cover" />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => scrollPhotos(1)}
                    className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-1.5 shadow-sm ${isArabic ? 'left-0' : 'right-0'}`}
                    aria-label={t('reviews.scrollPhotosRight')}
                  >
                    <ChevronRight size={16} className={isArabic ? 'rotate-180' : ''} />
                  </button>
                </div>
              </div>
            ) : null}

            <div>
              {visibleReviews.map((review, index) => (
                <ReviewCard
                  key={review._id || review.id || index}
                  review={review}
                  product={product}
                  onImageClick={setLightboxImage}
                  onHelpfulVote={handleHelpfulVote}
                  t={t}
                  isArabic={isArabic}
                  dateLocale={dateLocale}
                  guestLabel={guestLabel}
                />
              ))}
            </div>

            {filteredReviews.length > initialVisibleCount ? (
              <div className="pt-6 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllReviews((prev) => !prev)}
                  className="inline-flex min-w-[240px] items-center justify-center rounded-full border-2 border-blue-600 px-8 py-3 text-[15px] font-semibold text-blue-600 hover:bg-blue-50"
                >
                  {showAllReviews ? t('reviews.showLess') : t('reviews.showMore')}
                </button>
              </div>
            ) : null}
              </>
            )}
          </div>
        </div>
      )}

      {lightboxImage ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-4xl">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-2xl font-bold text-white hover:text-gray-300"
            >
              ×
            </button>
            <Image
              src={lightboxImage}
              alt="Review image full size"
              width={800}
              height={800}
              className="max-h-[85vh] w-auto rounded-lg object-contain"
            />
          </div>
        </div>
      ) : null}

      <WriteReviewModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        productId={productId}
        t={t}
        onReviewSubmitted={handleReviewSubmitted}
      />
    </section>
  );
}
