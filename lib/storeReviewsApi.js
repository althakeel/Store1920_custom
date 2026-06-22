export function enrichRatingUser(rating, userMap) {
  let userData = null;
  const userId = rating?.userId;

  if (typeof userId === 'string' && userId.match(/^[a-fA-F0-9]{24}$/)) {
    userData = userMap.get(userId) || null;
  } else if (typeof userId === 'object' && userId?._id) {
    userData = userId;
  }

  return {
    ...rating,
    user: userData || {
      name: rating.customerName || 'Guest',
      email: rating.customerEmail,
      image: '/placeholder-avatar.png',
    },
  };
}

export function buildReviewSummary(summary) {
  const reviewCount = Number(summary?.reviewCount || 0);
  const approvedCount = Number(summary?.approvedCount || 0);
  const approvedRatingSum = Number(summary?.approvedRatingSum || 0);

  return {
    count: reviewCount,
    pendingCount: Number(summary?.pendingCount || 0),
    averageRating: approvedCount > 0 ? approvedRatingSum / approvedCount : 0,
  };
}
