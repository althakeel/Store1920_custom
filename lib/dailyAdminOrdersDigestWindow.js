import {
  addDaysToDateOnly,
  buildOrdersByProductDateTime,
  getDubaiDateParts,
  ORDERS_BY_PRODUCT_TIMEZONE,
} from './storeOrdersByProductDates.js';

export const DAILY_ADMIN_DIGEST_CUTOVER = '10:00';

function getDubaiWeekdayShort(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ORDERS_BY_PRODUCT_TIMEZONE,
    weekday: 'short',
  }).format(date);
}

/**
 * Daily digest window (Dubai business day ending at the 10:00 cutover).
 * - Sun: skip (no email)
 * - Mon: Sat 10:00 → Mon 10:00 (covers Sunday)
 * - Tue–Sat: previous day 10:00 → today 10:00
 */
export function getDailyAdminDigestWindow(now = new Date()) {
  const weekday = getDubaiWeekdayShort(now);
  if (weekday === 'Sun') {
    return {
      skip: true,
      reason: 'sunday',
      weekday,
      timezone: ORDERS_BY_PRODUCT_TIMEZONE,
    };
  }

  const { date: endDate } = getDubaiDateParts(now);
  const startDate = weekday === 'Mon'
    ? addDaysToDateOnly(endDate, -2)
    : addDaysToDateOnly(endDate, -1);

  const start = buildOrdersByProductDateTime(startDate, DAILY_ADMIN_DIGEST_CUTOVER);
  const end = buildOrdersByProductDateTime(endDate, DAILY_ADMIN_DIGEST_CUTOVER);

  const label = weekday === 'Mon'
    ? `${startDate} ${DAILY_ADMIN_DIGEST_CUTOVER} – ${endDate} ${DAILY_ADMIN_DIGEST_CUTOVER} (Dubai, weekend window)`
    : `${startDate} ${DAILY_ADMIN_DIGEST_CUTOVER} – ${endDate} ${DAILY_ADMIN_DIGEST_CUTOVER} (Dubai)`;

  return {
    skip: false,
    reason: null,
    weekday,
    timezone: ORDERS_BY_PRODUCT_TIMEZONE,
    cutover: DAILY_ADMIN_DIGEST_CUTOVER,
    startDate,
    endDate,
    start,
    end,
    label,
  };
}
