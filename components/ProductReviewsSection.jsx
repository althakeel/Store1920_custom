'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { StarIcon, ChevronLeft, ChevronRight, ThumbsUp, BadgeCheck } from 'lucide-react';

const formatReviewDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const maskReviewerName = (name) => {
  const safeName = (name || 'Guest User').trim();
  if (safeName.length <= 2) return `${safeName[0] || 'U'}***`;
  if (safeName.length <= 5) return `${safeName.slice(0, 2)}***`;
  return `${safeName.slice(0, 3)}***${safeName.slice(-1)}`;
};

const toTitleCase = (value) => value
  .split(' ')
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

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

function RatingBar({ stars, count, total, barClassName }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="grid grid-cols-[34px_1fr_34px] items-center gap-2 text-[13px] text-gray-700">
      <span>{stars} ★</span>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-right text-gray-500">{percentage}%</span>
    </div>
  );
}

function ReviewCard({ review, productLabel, onImageClick }) {
  const [expanded, setExpanded] = useState(false);
  const reviewerName = review.user?.name || review.userId?.name || review.customerName || 'Guest User';
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
            <span className="font-semibold text-gray-900">{maskReviewerName(reviewerName)}</span>
            <span className="text-gray-400">|</span>
            <span>{formatReviewDate(review.createdAt)}</span>
            {review.orderId ? (
              <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                <BadgeCheck size={12} />
                Verified Purchase
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
            <div className="mt-2 text-[14px] leading-7 text-gray-900">
              <p>{displayText}</p>
              {shouldTruncate ? (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="mt-1 text-[13px] font-medium text-blue-600 hover:underline"
                >
                  {expanded ? 'Less' : 'More'}
                </button>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[12px] text-gray-600 hover:bg-gray-50"
          >
            <ThumbsUp size={13} />
            Helpful
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
}) {
  const [starFilter, setStarFilter] = useState('all');
  const [sortBy, setSortBy] = useState('top');
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [photoScrollRef, setPhotoScrollRef] = useState(null);

  const reviewCount = reviews.length;
  const averageRating = reviewCount > 0
    ? reviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / reviewCount
    : 0;

  const ratingBreakdown = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((review) => {
      const stars = Math.round(Number(review.rating) || 0);
      if (stars >= 1 && stars <= 5) counts[stars] += 1;
    });
    return counts;
  }, [reviews]);

  const reviewKeywordPills = useMemo(() => {
    if (!Array.isArray(reviews) || reviews.length === 0) return [];

    const stopWords = new Set([
      'the', 'and', 'for', 'that', 'this', 'with', 'you', 'your', 'are', 'was', 'were', 'from', 'have',
      'has', 'had', 'not', 'but', 'very', 'just', 'also', 'really', 'will', 'would', 'could', 'should',
      'its', 'it', 'they', 'them', 'their', 'our', 'out', 'into', 'onto', 'about', 'after', 'before',
      'been', 'being', 'can', 'item', 'product', 'order', 'delivery', 'shipping', 'arrived', 'good',
      'nice', 'great', 'best', 'bad', 'poor', 'ok', 'okay', 'use', 'used', 'using', 'one', 'two', 'buy', 'bought',
    ]);

    const wordFrequency = new Map();
    const phraseFrequency = new Map();

    reviews.forEach((review) => {
      const rawText = String(review?.review || review?.comment || '').toLowerCase();
      if (!rawText.trim()) return;

      const tokens = rawText
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 3 && !stopWords.has(word) && !/^\d+$/.test(word));

      const uniqueWordsInReview = new Set(tokens);
      uniqueWordsInReview.forEach((word) => {
        wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
      });

      for (let index = 0; index < tokens.length - 1; index += 1) {
        const phrase = `${tokens[index]} ${tokens[index + 1]}`;
        phraseFrequency.set(phrase, (phraseFrequency.get(phrase) || 0) + 1);
      }
    });

    const pills = [
      ...[...phraseFrequency.entries()].filter(([, count]) => count >= 2).map(([label, count]) => ({ label: toTitleCase(label), count })),
      ...[...wordFrequency.entries()].filter(([, count]) => count >= 2).map(([label, count]) => ({ label: toTitleCase(label), count })),
    ]
      .sort((a, b) => b.count - a.count || a.label.length - b.label.length)
      .filter((pill, index, array) => array.findIndex((entry) => entry.label === pill.label) === index)
      .slice(0, 4);

    return pills;
  }, [reviews]);

  const customerPhotos = useMemo(() => {
    return reviews.flatMap((review) => (Array.isArray(review.images) ? review.images : [])).filter(Boolean);
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    let next = [...reviews];

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
  }, [reviews, sortBy, starFilter]);

  const visibleReviews = showAllReviews ? filteredReviews : filteredReviews.slice(0, initialVisibleCount);
  const productLabel = product?.name ? `Product: ${product.name}` : '';

  const scrollPhotos = (direction) => {
    if (!photoScrollRef) return;
    photoScrollRef.scrollBy({ left: direction * 220, behavior: 'smooth' });
  };

  return (
    <section id="product-reviews" className="border-t border-gray-200 pt-8">
      <h2 className="text-[22px] sm:text-[24px] font-semibold text-gray-900 mb-6">
        Product Ratings &amp; Reviews
      </h2>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-xl bg-gray-100" />
          <div className="h-40 rounded-xl bg-gray-100" />
        </div>
      ) : reviewCount === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-lg font-semibold text-gray-900">No reviews yet</p>
          <p className="mt-2 text-sm text-gray-600">
            Be the first to review this product after your order is delivered.
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
              <p className="mt-2 text-[13px] text-gray-600">Based on {reviewCount} {reviewCount === 1 ? 'rating' : 'ratings'}</p>
            </div>

            <div className="space-y-2">
              <RatingBar stars={5} count={ratingBreakdown[5]} total={reviewCount} barClassName="bg-green-500" />
              <RatingBar stars={4} count={ratingBreakdown[4]} total={reviewCount} barClassName="bg-green-400" />
              <RatingBar stars={3} count={ratingBreakdown[3]} total={reviewCount} barClassName="bg-yellow-400" />
              <RatingBar stars={2} count={ratingBreakdown[2]} total={reviewCount} barClassName="bg-orange-400" />
              <RatingBar stars={1} count={ratingBreakdown[1]} total={reviewCount} barClassName="bg-red-500" />
            </div>

            <div className="space-y-4 rounded-xl border border-gray-200 p-4">
              <div>
                <div className="flex items-center gap-2 text-[14px] font-semibold text-gray-900">
                  <StarIcon size={14} className="text-amber-500" fill="#f59e0b" />
                  How do I review this product?
                </div>
                <p className="mt-2 text-[13px] leading-6 text-gray-600">
                  If you recently purchased this item, go to your order details page and leave a review from there.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[14px] font-semibold text-gray-900">
                  <StarIcon size={14} className="text-amber-500" fill="#f59e0b" />
                  Where do the reviews come from?
                </div>
                <p className="mt-2 text-[13px] leading-6 text-gray-600">
                  Reviews shown here are from customers who purchased this item on Store1920.
                </p>
              </div>
            </div>
          </aside>

          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h3 className="text-[18px] font-semibold text-gray-900">Reviews</h3>
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-gray-600">
                <label className="inline-flex items-center gap-2">
                  <span className="font-semibold uppercase tracking-wide">Filter by:</span>
                  <select
                    value={starFilter}
                    onChange={(event) => setStarFilter(event.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-800"
                  >
                    <option value="all">All Stars</option>
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                  </select>
                </label>
                <label className="inline-flex items-center gap-2">
                  <span className="font-semibold uppercase tracking-wide">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-800"
                  >
                    <option value="top">Top Reviews</option>
                    <option value="recent">Most Recent</option>
                    <option value="lowest">Lowest Rating</option>
                  </select>
                </label>
              </div>
            </div>

            {reviewKeywordPills.length > 0 ? (
              <div className="mb-5 rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-[13px] font-medium bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                  Store1920 is summarising the reviews
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {reviewKeywordPills.map((pill) => (
                    <span
                      key={pill.label}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[12px] text-gray-700"
                    >
                      {pill.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {customerPhotos.length > 0 ? (
              <div className="mb-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-[15px] font-semibold text-gray-900">
                    Customer Photos ({customerPhotos.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setLightboxImage(customerPhotos[0])}
                    className="text-[13px] font-medium text-blue-600 hover:underline"
                  >
                    View all &gt;
                  </button>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => scrollPhotos(-1)}
                    className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-1.5 shadow-sm"
                    aria-label="Scroll photos left"
                  >
                    <ChevronLeft size={16} />
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
                    className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-1.5 shadow-sm"
                    aria-label="Scroll photos right"
                  >
                    <ChevronRight size={16} />
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
                  {showAllReviews ? 'Show Fewer Reviews' : 'View All Reviews >'}
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
