export const ORDERS_BY_PRODUCT_DATE_PRESETS = ['TODAY', 'LAST_WEEK', 'LAST_MONTH', 'CUSTOM'];
export const DEFAULT_ORDERS_BY_PRODUCT_TIME = '10:00';
export const ORDERS_BY_PRODUCT_TIMEZONE = 'Asia/Dubai';

/** UAE has no DST — wall clock is always UTC+4. */
const DUBAI_UTC_OFFSET_HOURS = 4;

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function normalizeOrdersByProductTime(value = '', fallback = DEFAULT_ORDERS_BY_PRODUCT_TIME) {
  const text = String(value || fallback).trim();
  if (/^\d{2}:\d{2}$/.test(text)) return text;
  if (/^\d{2}:\d{2}:\d{2}$/.test(text)) return text.slice(0, 5);
  return fallback;
}

export function getDubaiDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ORDERS_BY_PRODUCT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const hourRaw = Number(parts.hour);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: hourRaw === 24 ? 0 : hourRaw,
    minute: Number(parts.minute),
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function addDaysToDateOnly(dateValue = '', days = 0) {
  const [year, month, day] = String(dateValue || '').split('-').map(Number);
  if (!year || !month || !day) return '';
  const utc = new Date(Date.UTC(year, month - 1, day + Number(days || 0), 12, 0, 0));
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}

/** Interpret YYYY-MM-DD + HH:mm as Asia/Dubai wall time → UTC Date. */
export function buildOrdersByProductDateTime(dateValue = '', timeValue = '') {
  if (!dateValue) return null;
  const time = normalizeOrdersByProductTime(timeValue, '00:00');
  const [year, month, day] = String(dateValue).split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (!year || !month || !day || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return new Date(Date.UTC(
    year,
    month - 1,
    day,
    hour - DUBAI_UTC_OFFSET_HOURS,
    minute,
    0,
    0,
  ));
}

function buildCreatedAtRange(start, end) {
  if (!start && !end) return {};
  if (start && end) return { createdAt: { $gte: start, $lt: end } };
  if (start) return { createdAt: { $gte: start } };
  return { createdAt: { $lt: end } };
}

function buildOrdersByProductRange(fromDate, toDate, fromTime, toTime) {
  const start = buildOrdersByProductDateTime(fromDate, fromTime);
  let end = buildOrdersByProductDateTime(toDate, toTime);
  if (start && end && end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return buildCreatedAtRange(start, end);
}

/**
 * Current store business day using a Dubai cutover (default 10:00).
 * Before cutover → previous day@cutover → today@cutover.
 * After cutover → today@cutover → tomorrow@cutover.
 */
export function getOrdersByProductBusinessDayBounds(
  cutoverTime = DEFAULT_ORDERS_BY_PRODUCT_TIME,
  now = new Date(),
) {
  const parts = getDubaiDateParts(now);
  const cutover = normalizeOrdersByProductTime(cutoverTime);
  const todayCutover = buildOrdersByProductDateTime(parts.date, cutover);
  if (!todayCutover) return { start: null, end: null, startDate: '', endDate: '' };

  if (now.getTime() >= todayCutover.getTime()) {
    const endDate = addDaysToDateOnly(parts.date, 1);
    return {
      start: todayCutover,
      end: buildOrdersByProductDateTime(endDate, cutover),
      startDate: parts.date,
      endDate,
    };
  }

  const startDate = addDaysToDateOnly(parts.date, -1);
  return {
    start: buildOrdersByProductDateTime(startDate, cutover),
    end: todayCutover,
    startDate,
    endDate: parts.date,
  };
}

function formatOrdersByProductTimeLabel(value = '') {
  const time = normalizeOrdersByProductTime(value);
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${pad2(minute)} ${suffix}`;
}

export function buildOrdersByProductDateFilter(
  dateRange = 'TODAY',
  fromDate = '',
  toDate = '',
  fromTime = DEFAULT_ORDERS_BY_PRODUCT_TIME,
  toTime = DEFAULT_ORDERS_BY_PRODUCT_TIME,
  now = new Date(),
) {
  const normalizedFromTime = normalizeOrdersByProductTime(fromTime);
  const normalizedToTime = normalizeOrdersByProductTime(toTime);
  const dubaiNow = getDubaiDateParts(now);

  switch (String(dateRange || '').toUpperCase()) {
    case 'TODAY': {
      const bounds = getOrdersByProductBusinessDayBounds(normalizedFromTime, now);
      if (normalizedToTime !== normalizedFromTime && bounds.startDate) {
        const endDate = normalizedToTime > normalizedFromTime
          ? bounds.startDate
          : bounds.endDate;
        return buildCreatedAtRange(
          bounds.start,
          buildOrdersByProductDateTime(endDate, normalizedToTime),
        );
      }
      return buildCreatedAtRange(bounds.start, bounds.end);
    }
    case 'LAST_WEEK': {
      const bounds = getOrdersByProductBusinessDayBounds(normalizedToTime, now);
      const startDate = addDaysToDateOnly(bounds.startDate, -6);
      return buildCreatedAtRange(
        buildOrdersByProductDateTime(startDate, normalizedFromTime),
        bounds.end,
      );
    }
    case 'LAST_MONTH': {
      const monthIndex = dubaiNow.month - 2;
      const year = monthIndex >= 0 ? dubaiNow.year : dubaiNow.year - 1;
      const month = ((monthIndex + 12) % 12) + 1;
      const startDate = `${year}-${pad2(month)}-01`;
      const endYear = month === 12 ? year + 1 : year;
      const endMonth = month === 12 ? 1 : month + 1;
      const endDate = `${endYear}-${pad2(endMonth)}-01`;
      return buildCreatedAtRange(
        buildOrdersByProductDateTime(startDate, normalizedFromTime),
        buildOrdersByProductDateTime(endDate, normalizedToTime),
      );
    }
    case 'CUSTOM':
      if (fromDate && toDate) {
        return buildOrdersByProductRange(fromDate, toDate, normalizedFromTime, normalizedToTime);
      }
      return {};
    default: {
      const bounds = getOrdersByProductBusinessDayBounds(normalizedFromTime, now);
      return buildCreatedAtRange(bounds.start, bounds.end);
    }
  }
}

export function getOrdersByProductDateLabel(
  dateRange = 'TODAY',
  fromDate = '',
  toDate = '',
  fromTime = DEFAULT_ORDERS_BY_PRODUCT_TIME,
  toTime = DEFAULT_ORDERS_BY_PRODUCT_TIME,
  now = new Date(),
) {
  const fromTimeLabel = formatOrdersByProductTimeLabel(fromTime);
  const toTimeLabel = formatOrdersByProductTimeLabel(toTime);
  const bounds = getOrdersByProductBusinessDayBounds(fromTime, now);

  switch (String(dateRange || '').toUpperCase()) {
    case 'TODAY':
      return `Business day ${bounds.startDate} ${fromTimeLabel} – ${bounds.endDate} ${toTimeLabel} (Dubai)`;
    case 'LAST_WEEK': {
      const startDate = addDaysToDateOnly(bounds.startDate, -6);
      return `${startDate} ${fromTimeLabel} – ${bounds.endDate} ${toTimeLabel} (Dubai)`;
    }
    case 'LAST_MONTH':
      return `Last calendar month, ${fromTimeLabel} – ${toTimeLabel} (Dubai)`;
    case 'CUSTOM':
      if (fromDate && toDate) {
        return `${fromDate} ${fromTimeLabel} – ${toDate} ${toTimeLabel} (Dubai)`;
      }
      return 'Custom range';
    default:
      return `Business day ${bounds.startDate} ${fromTimeLabel} – ${bounds.endDate} ${toTimeLabel} (Dubai)`;
  }
}
