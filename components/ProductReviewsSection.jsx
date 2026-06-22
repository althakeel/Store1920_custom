'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import axios from 'axios';
import { StarIcon, ChevronLeft, ChevronRight, ThumbsUp, BadgeCheck } from 'lucide-react';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';

const HELPFUL_VOTER_KEY = 'store1920_helpful_voter';

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

const formatReviewDate = (dateString, locale = 'en-GB') => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
};

const maskReviewerName = (name, guestLabel = 'Guest User') => {
  const safeName = (name || guestLabel).trim();
  if (safeName.length <= 2) return `${safeName[0] || 'U'}***`;
  if (safeName.length <= 5) return `${safeName.slice(0, 2)}***`;
  return `${safeName.slice(0, 3)}***${safeName.slice(-1)}`;
};

function StarRow({ rating, size = 16, filledColor = '#16a34a', emptyColor = '#d1d5db' }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <StarIcon
          key={index}
          size={size}
          className="text-transparent"
          fill={index < Math.round(rating) ? filledColor : emptyColor}
        />
      ))}
    </div>
  );
}

function RatingBar({ stars, count, total, barClassName, isArabic }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="grid grid-cols-[34px_1fr_34px] items-center gap-2 text-[13px] text-gray-700">
      <span>{stars} ★</span>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${percentage}%` }} />
      </div>
      <span className={`text-gray-500 ${isArabic ? 'text-left' : 'text-right'}`}>{percentage}%</span>
    </div>
  );
}

function ReviewCard({ review, productLabel, onImageClick, onHelpfulVote, t, isArabic, dateLocale, guestLabel }) {
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
  const shouldTruncate = reviewText.length > 220;
  const displayText = expanded || !shouldTruncate ? reviewText : `${reviewText.slice(0, 220).trim()}...`;

  return (
    <div className="border-b border-gray-200 py-5 last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold flex items-center justify-center overflow-hidden shrink-0">
          {reviewerName[0]?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-gray-700">
            <span className="font-semibold text-gray-900">{maskReviewerName(reviewerName, guestLabel)}</span>
            <span className="text-gray-400">|</span>
            <span>{formatReviewDate(review.createdAt, dateLocale)}</span>
            {review.orderId ? (
              <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                <BadgeCheck size={12} />
                {t('reviews.verifiedPurchase')}
              </span>
            ) : null}
          </div>

          <div className="mt-2">
            <StarRow rating={review.rating || 0} size={15} />
          </div>

          {Array.isArray(review.images) && review.images.length > 0 ? (
            <div className="mt-3 flex gap-2 flex-wrap">
              {review.images.map((img, imageIdx) => (
                <button
                  key={`${review._id || review.id}-img-${imageIdx}`}
                  type="button"
                  onClick={() => onImageClick?.(img)}
                  className="relative h-16 w-16 overflow-hidden rounded-md border border-gray-200"
                >
                  <Image src={img} alt={`Review photo ${imageIdx + 1}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          {productLabel ? (
            <p className="mt-3 text-[12px] leading-5 text-gray-500">{productLabel}</p>
          ) : null}

          {reviewText ? (
            <div className="mt-2 text-[14px] leading-7 text-gray-900" dir="auto">
              <p>{displayText}</p>
              {shouldTruncate ? (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="mt-1 text-[13px] font-medium text-blue-600 hover:underline"
                >
                  {expanded ? t('reviews.less') : t('reviews.more')}
                </button>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleHelpfulClick}
            disabled={voting || hasVoted || !reviewId}
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition ${
              hasVoted
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            } disabled:cursor-default`}
          >
            <ThumbsUp size={13} />
            {helpfulLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductReviewsSection({
  product,
  reviews = [],
  loading = false,
  initialVisibleCount = 4,
  compactMobile = false,
}) {
  const { t, isArabic } = useStorefrontI18n();
  const [starFilter, setStarFilter] = useState('all');
  const [sortBy, setSortBy] = useState('top');
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
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

  const dateLocale = isArabic ? 'ar-AE' : 'en-GB';
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

  const customerPhotos = useMemo(() => {
    return reviewItems.flatMap((review) => (Array.isArray(review.images) ? review.images : [])).filter(Boolean);
  }, [reviewItems]);

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
  const productLabel = product?.name
    ? t('reviews.productLabel', { name: product.name })
    : '';

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

  return (
    <section
      id="product-reviews"
      className={compactMobile ? 'border-t border-gray-100 pt-3' : 'border-t border-gray-200 pt-8'}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <h2 className={`font-semibold text-gray-900 ${compactMobile ? 'mb-3 text-[18px]' : 'mb-6 text-[22px] sm:text-[24px]'}`}>
        {t('reviews.title')}
      </h2>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-xl bg-gray-100" />
          <div className="h-40 rounded-xl bg-gray-100" />
        </div>
      ) : reviewCount === 0 ? (
        <div className={`rounded-xl border border-gray-200 bg-gray-50 text-center ${compactMobile ? 'p-5' : 'p-8'}`}>
          <p className="text-lg font-semibold text-gray-900">{t('reviews.noReviewsTitle')}</p>
          <p className="mt-2 text-sm text-gray-600">
            {t('reviews.noReviewsBody')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-8 lg:gap-10">
          <aside className="space-y-6">
            <div>
              <div className="flex items-end gap-3">
                <span className="text-[42px] leading-none font-semibold text-gray-900">{averageRating.toFixed(1)}</span>
                <StarRow rating={averageRating} size={18} />
              </div>
              <p className="mt-2 text-[13px] text-gray-600">
                {t('reviews.basedOn', { count: reviewCount, label: getRatingLabel(reviewCount) })}
              </p>
            </div>

            <div className="space-y-2">
              <RatingBar stars={5} count={ratingBreakdown[5]} total={reviewCount} barClassName="bg-green-500" isArabic={isArabic} />
              <RatingBar stars={4} count={ratingBreakdown[4]} total={reviewCount} barClassName="bg-green-400" isArabic={isArabic} />
              <RatingBar stars={3} count={ratingBreakdown[3]} total={reviewCount} barClassName="bg-yellow-400" isArabic={isArabic} />
              <RatingBar stars={2} count={ratingBreakdown[2]} total={reviewCount} barClassName="bg-orange-400" isArabic={isArabic} />
              <RatingBar stars={1} count={ratingBreakdown[1]} total={reviewCount} barClassName="bg-red-500" isArabic={isArabic} />
            </div>

            <div className="space-y-4 rounded-xl border border-gray-200 p-4">
              <div>
                <div className="flex items-center gap-2 text-[14px] font-semibold text-gray-900">
                  <StarIcon size={14} className="text-amber-500" fill="#f59e0b" />
                  {t('reviews.howToReviewTitle')}
                </div>
                <p className="mt-2 text-[13px] leading-6 text-gray-600">
                  {t('reviews.howToReviewBody')}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[14px] font-semibold text-gray-900">
                  <StarIcon size={14} className="text-amber-500" fill="#f59e0b" />
                  {t('reviews.whereFromTitle')}
                </div>
                <p className="mt-2 text-[13px] leading-6 text-gray-600">
                  {t('reviews.whereFromBody')}
                </p>
              </div>
            </div>
          </aside>

          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h3 className="text-[18px] font-semibold text-gray-900">{t('reviews.heading')}</h3>
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-gray-600">
                <label className="inline-flex items-center gap-2">
                  <span className="font-semibold uppercase tracking-wide">{t('reviews.filterBy')}</span>
                  <select
                    value={starFilter}
                    onChange={(event) => setStarFilter(event.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-800"
                  >
                    {['all', '5', '4', '3', '2', '1'].map((value) => (
                      <option key={value} value={value}>
                        {starOptionLabel(value === 'all' ? 'all' : Number(value))}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex items-center gap-2">
                  <span className="font-semibold uppercase tracking-wide">{t('reviews.sortBy')}</span>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-800"
                  >
                    <option value="top">{t('reviews.topReviews')}</option>
                    <option value="recent">{t('reviews.mostRecent')}</option>
                    <option value="lowest">{t('reviews.lowestRating')}</option>
                  </select>
                </label>
              </div>
            </div>

            {customerPhotos.length > 0 ? (
              <div className="mb-6">
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
                        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-gray-200"
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
                  productLabel={productLabel}
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
              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllReviews((prev) => !prev)}
                  className="inline-flex min-w-[220px] items-center justify-center rounded-full border border-blue-600 px-6 py-2.5 text-[14px] font-semibold text-blue-600 hover:bg-blue-50"
                >
                  {showAllReviews ? t('reviews.showFewer') : t('reviews.viewAllReviews')}
                </button>
              </div>
            ) : null}
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
    </section>
  );
}
