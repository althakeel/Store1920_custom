/** Map Waslah webhook / history subtags to Store1920 order statuses. */

const SUBTAG_STATUS_MAP = {
  // Created / pre-pickup
  DropOff_001: 'PROCESSING',
  NewShipment_001: 'PROCESSING',
  InfoReceived_001: 'PROCESSING',
  Pending_001: 'PROCESSING',
  Pending_002: 'PROCESSING',
  Pending_003: 'PROCESSING',
  Pending_004: 'PROCESSING',
  Pending_005: 'PROCESSING',
  Pending_006: 'PROCESSING',
  LabelGenerated_001: 'PROCESSING',
  PickupRequested_001: 'PICKUP_REQUESTED',
  Fulfillment_001: 'PROCESSING',
  ReverseRequested_001: 'PROCESSING',
  ReadyForCollection_001: 'PROCESSING',
  AvailableForPickup_001: 'WAITING_FOR_PICKUP',

  // In network
  PickedUp_001: 'PICKED_UP',
  PickedUp_002: 'PICKED_UP',
  InTransit_001: 'SHIPPED',
  InTransit_002: 'SHIPPED',
  InTransit_003: 'SHIPPED',
  InTransit_004: 'SHIPPED',
  InTransit_005: 'SHIPPED',
  InTransit_006: 'SHIPPED',
  InTransit_007: 'SHIPPED',
  InTransit_008: 'SHIPPED',
  InTransit_009: 'SHIPPED',
  InTransit_010: 'SHIPPED',
  InSorting_001: 'SHIPPED',
  InSorting_002: 'SHIPPED',
  InSorting_003: 'SHIPPED',
  OutForDelivery_001: 'OUT_FOR_DELIVERY',
  Fulfillment_002: 'SHIPPED',

  // Delivered / settled
  Delivered_001: 'DELIVERED',
  Settled_To_Seller_001: 'DELIVERED',
  Settled_By_Carrier_001: 'DELIVERED',

  // Returns / RTO — customer did not collect; parcel returned to shipper
  RTO_Received_001: 'RTO',
  RTO_Delivered_001: 'RTO',
  ReturnToShipper_001: 'RTO',
  ToBeReturned_001: 'RTO',
  ReadyForReturn_001: 'RTO',

  // Customer return after delivery
  Return_Received_001: 'RETURN',

  // Terminal negative
  Cancelled_001: 'CANCELLED',
  Lost_001: 'CANCELLED',
  Damaged_001: 'CANCELLED',
  Disposed_001: 'CANCELLED',
  Fulfillment_003: 'CANCELLED',

  // Failed attempts stay shipped — courier will retry
  FailedAttempt_001: 'SHIPPED',
  FailedAttempt_002: 'SHIPPED',
  FailedAttempt_003: 'SHIPPED',
  FailedAttempt_004: 'SHIPPED',
  FailedAttempt_005: 'SHIPPED',
  FailedAttempt_006: 'SHIPPED',
  FailedAttempt_007: 'SHIPPED',
  FailedAttempt_008: 'SHIPPED',
  FailedAttempt_009: 'SHIPPED',
  FailedAttempt_010: 'SHIPPED',
  FailedAttempt_011: 'SHIPPED',
  FailedAttempt_012: 'SHIPPED',
  FailedAttempt_013: 'SHIPPED',
  FailedAttempt_014: 'SHIPPED',
  FailedAttempt_015: 'SHIPPED',
  FailedAttempt_016: 'SHIPPED',

  // Retryable exceptions stay in delivery; terminal exception variants follow.
  Exception_001: 'SHIPPED',
  Exception_002: 'SHIPPED',
  Exception_003: 'SHIPPED',
  Exception_004: 'SHIPPED',
  Exception_005: 'SHIPPED',
  Exception_010: 'RTO',
  Exception_011: 'RTO',
  Exception_012: 'CANCELLED',
  Exception_013: 'CANCELLED',
  Exception_014: 'PROCESSING',
  Exception_020: 'CANCELLED',
  Exception_021: 'CANCELLED',
};

function normalizeWaslahStatusToken(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const NORMALIZED_SUBTAG_STATUS_MAP = new Map(
  Object.entries(SUBTAG_STATUS_MAP).map(([subtag, status]) => [
    normalizeWaslahStatusToken(subtag),
    status,
  ]),
);

export function mapWaslahSubtagToOrderStatus(subtag = '') {
  const key = String(subtag || '').trim();
  if (!key) return null;

  const exact = SUBTAG_STATUS_MAP[key]
    || NORMALIZED_SUBTAG_STATUS_MAP.get(normalizeWaslahStatusToken(key));
  if (exact) return exact;

  // Waslah can add new numeric variants (for example OutForDelivery_002),
  // and courier webhooks sometimes send human-readable EMX status names.
  const token = normalizeWaslahStatusToken(key).replace(/\d+$/, '');
  if (!token) return null;

  if (
    token.includes('cancel')
    || token.includes('voided')
    || token.startsWith('lost')
    || token.startsWith('damaged')
    || token.startsWith('disposed')
  ) return 'CANCELLED';

  if (
    token.includes('returnreceived')
    || token.includes('customerreturn')
    || token.includes('returnedafterdelivery')
  ) return 'RETURN';

  if (
    token.startsWith('rto')
    || token.includes('returntoshipper')
    || token.includes('returntoorigin')
    || token.includes('returningtoshipper')
    || token.includes('returnedtoshipper')
    || token.includes('returningtosender')
    || token.includes('returnedtosender')
    || token.includes('shipmentreturnedtosender')
    || token.includes('tobereturned')
    || token.includes('readyforreturn')
  ) return 'RTO';

  if (token.includes('outfordelivery')) return 'OUT_FOR_DELIVERY';
  if (
    token.includes('undelivered')
    || token.startsWith('attemptfail')
    || token.startsWith('failedattempt')
  ) return 'SHIPPED';
  if (
    token.includes('delivered')
    || token.includes('settledtoseller')
    || token.includes('settledbycarrier')
  ) return 'DELIVERED';

  if (
    token.includes('pickedup')
    || token.includes('collectedbycourier')
  ) return 'PICKED_UP';

  if (
    token.includes('intransit')
    || token.includes('insorting')
    || token.includes('dispatched')
    || token.includes('forwarded')
    || token.includes('shipped')
    || token.startsWith('exception')
  ) return 'SHIPPED';

  if (token.includes('pickuprequested')) return 'PICKUP_REQUESTED';

  if (
    token.includes('newshipment')
    || token.includes('shipmentcreated')
    || token.includes('labelgenerated')
    || token.includes('waitingforpickup')
    || token.includes('readyforcollection')
    || token.includes('expectingshipment')
    || token.includes('inforeceived')
    || token.startsWith('pending')
    || token.startsWith('dropoff')
  ) return 'PROCESSING';

  return null;
}

/**
 * Courier cancellation closes the AWB, not the merchant's underlying order.
 * Keep it visible in `waslah.appStatus`, but do not copy it to `order.status`.
 */
export function shouldPropagateWaslahStatusToOrder(status = '') {
  const normalized = String(status || '').trim().toUpperCase();
  return Boolean(normalized) && normalized !== 'CANCELLED';
}

const TERMINAL_WASLAH_COURIER_STATUSES = new Set([
  'DELIVERED',
  'RTO',
  'RETURN',
  'RETURNED',
  'CANCELLED',
]);

/** Higher = further along fulfillment. Used to block courier sync from downgrading status. */
const WASLAH_ORDER_STATUS_PROGRESS = {
  ORDER_PLACED: 10,
  PROCESSING: 20,
  WAITING_FOR_PICKUP: 30,
  PICKUP_REQUESTED: 40,
  PICKED_UP: 50,
  WAREHOUSE_RECEIVED: 50,
  SHIPPED: 60,
  IN_TRANSIT: 60,
  OUT_FOR_DELIVERY: 70,
  DELIVERED: 80,
};

export function resolveWaslahOrderStatusTransition(
  courierStatus = '',
  currentStatus = '',
  { packed = false } = {},
) {
  const next = String(courierStatus || '').trim().toUpperCase();
  const current = String(currentStatus || '').trim().toUpperCase();
  if (!shouldPropagateWaslahStatusToOrder(next)) return null;

  if (
    current
    && TERMINAL_WASLAH_COURIER_STATUSES.has(current)
    && next !== current
  ) {
    if (current === 'DELIVERED' && next === 'RETURN') return next;
    return null;
  }

  // Warehouse "Mark packed" sets WAITING_FOR_PICKUP — do not let EMX "label ready"
  // / early courier states push the order back to PROCESSING.
  if (
    packed
    && (next === 'PROCESSING' || next === 'ORDER_PLACED')
    && (
      current === 'WAITING_FOR_PICKUP'
      || current === 'PICKUP_REQUESTED'
      || current === 'PICKED_UP'
      || current === 'WAREHOUSE_RECEIVED'
      || current === 'SHIPPED'
      || current === 'OUT_FOR_DELIVERY'
    )
  ) {
    return null;
  }

  const currentRank = WASLAH_ORDER_STATUS_PROGRESS[current];
  const nextRank = WASLAH_ORDER_STATUS_PROGRESS[next];
  if (
    Number.isFinite(currentRank)
    && Number.isFinite(nextRank)
    && nextRank < currentRank
  ) {
    return null;
  }

  return next;
}

export function getWaslahCourierStatus(order = {}) {
  const waslah = order?.waslah || {};
  return String(
    waslah.appStatus
    || waslah.carrierStatus
    || mapWaslahSubtagToOrderStatus(waslah.currentSubtag || waslah.lastSubtag)
    || '',
  ).trim().toUpperCase();
}

export function isWaslahCourierTerminal(order = {}) {
  const courierStatus = getWaslahCourierStatus(order);
  if (courierStatus) return TERMINAL_WASLAH_COURIER_STATUSES.has(courierStatus);
  return TERMINAL_WASLAH_COURIER_STATUSES.has(String(order?.status || '').toUpperCase());
}

/** Fallback when EMX/Waslah sends message text without a known subtag code. */
export function mapWaslahTrackingToOrderStatus({
  subtag = '',
  message = '',
  subtagMessage = '',
} = {}) {
  const fromSubtag = mapWaslahSubtagToOrderStatus(subtag);

  const text = `${subtagMessage} ${message} ${subtag}`.toLowerCase();
  if (
    text.includes('cancelled')
    || text.includes('canceled')
    || text.includes('cancellation')
    || text.includes('shipment cancel')
    || text.includes('voided')
  ) {
    return 'CANCELLED';
  }
  if (
    /\brto\b/.test(text)
    || text.includes('return to shipper')
    || text.includes('returned to shipper')
    || text.includes('return to origin')
    || text.includes('not collected')
    || text.includes('returning to sender')
    || text.includes('returned to sender')
    || text.includes('returned to seller')
  ) {
    return 'RTO';
  }
  if (
    text.includes('return received')
    || text.includes('customer return')
    || text.includes('returned after delivery')
  ) {
    return 'RETURN';
  }
  if (
    text.includes('undelivered')
    || text.includes('failed delivery')
    || text.includes('delivery failed')
    || text.includes('failed to deliver')
    || text.includes('could not deliver')
    || text.includes('not delivered')
    || text.includes('attempt failed')
  ) {
    return 'SHIPPED';
  }
  if (text.includes('delivered') && !text.includes('undelivered') && !text.includes('rto')) {
    return 'DELIVERED';
  }

  // A specific terminal/failure message above must beat a generic tag such as
  // Exception or Pending. Otherwise, prefer the provider's structured subtag.
  if (fromSubtag) return fromSubtag;

  if (text.includes('out for delivery')) {
    return 'OUT_FOR_DELIVERY';
  }
  if (
    text.includes('picked up')
    || text.includes('picked-up')
    || text.includes('collected by courier')
  ) {
    return 'PICKED_UP';
  }
  if (
    text.includes('in transit')
    || text.includes('in-transit')
    || text.includes('sorting')
    || text.includes('dispatched')
    || text.includes('forwarded')
    || text.includes('shipped')
    || text.includes('failed attempt')
    || text.includes('delivery attempt')
    || text.includes('delivery exception')
  ) {
    return 'SHIPPED';
  }
  if (
    text.includes('shipment created')
    || text.includes('new shipment')
    || text.includes('label generated')
    || text.includes('waiting for pickup')
    || text.includes('ready for collection')
    || text.includes('expecting the shipment')
  ) {
    return 'PROCESSING';
  }
  if (text.includes('pickup requested')) return 'PICKUP_REQUESTED';
  return null;
}

export function parseWaslahTrackingTimestamp(value) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : Number.NaN;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;

  const text = String(value || '').trim();
  if (!text) return Number.NaN;

  // EMX also emits Dubai-local timestamps such as 19/05/2023 02:51:24 PM.
  const localized = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i,
  );
  if (localized) {
    const [, dayText, monthText, yearText, hourText, minuteText, secondText = '0', meridiem] = localized;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    let hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    if (meridiem) {
      hour %= 12;
      if (meridiem.toUpperCase() === 'PM') hour += 12;
    }

    if (
      month >= 1 && month <= 12
      && day >= 1 && day <= 31
      && hour >= 0 && hour <= 23
      && minute >= 0 && minute <= 59
      && second >= 0 && second <= 59
    ) {
      const dubaiOffsetMs = 4 * 60 * 60 * 1000;
      const timestamp = Date.UTC(year, month - 1, day, hour, minute, second) - dubaiOffsetMs;
      const localCheck = new Date(timestamp + dubaiOffsetMs);
      if (
        localCheck.getUTCFullYear() === year
        && localCheck.getUTCMonth() === month - 1
        && localCheck.getUTCDate() === day
      ) return timestamp;
    }
    return Number.NaN;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function isWaslahTrackingEventOlder(incomingTime, storedTime) {
  const incoming = parseWaslahTrackingTimestamp(incomingTime);
  const stored = parseWaslahTrackingTimestamp(storedTime);
  return Number.isFinite(incoming) && Number.isFinite(stored) && incoming < stored;
}

function getWaslahEventTime(entry = {}) {
  return entry?.time
    || entry?.date
    || entry?.created_at
    || entry?.timestamp
    || entry?.updated_at
    || entry?.checkpoint_time
    || entry?.timeStamp
    || entry?.Time_Stamp
    || entry?.event_time
    || entry?.eventTime
    || '';
}

function getWaslahEventSubtag(entry = {}) {
  const statusValue = typeof entry?.status === 'string' ? entry.status : '';
  return String(
    entry?.subtag
    || entry?.subTag
    || entry?.tag
    || entry?.sub_status
    || entry?.subStatus
    || entry?.SubStatus
    || entry?.status_code
    || entry?.statusCode
    || entry?.status?.code
    || statusValue
    || '',
  ).trim();
}

function getWaslahEventMessage(entry = {}) {
  const statusValue = typeof entry?.status === 'string' ? entry.status : '';
  return String(
    entry?.subtag_message
    || entry?.subtagMessage
    || entry?.message
    || entry?.Message
    || entry?.remarks
    || entry?.Remarks
    || entry?.Status
    || entry?.status?.descriptionEn
    || entry?.status?.description
    || statusValue
    || '',
  ).trim();
}

/** Return a stable newest-first list, regardless of the order used by the provider. */
function sortWaslahEventsNewestFirst(entries = []) {
  return [...entries]
    .map((entry, index) => {
      const parsedTime = parseWaslahTrackingTimestamp(getWaslahEventTime(entry));
      return {
        entry,
        index,
        parsedTime: Number.isFinite(parsedTime) ? parsedTime : null,
      };
    })
    .sort((left, right) => {
      if (left.entry?.authoritative && !right.entry?.authoritative) return -1;
      if (!left.entry?.authoritative && right.entry?.authoritative) return 1;
      if (left.parsedTime !== null && right.parsedTime !== null && left.parsedTime !== right.parsedTime) {
        return right.parsedTime - left.parsedTime;
      }
      if (left.parsedTime !== null && right.parsedTime === null) return -1;
      if (left.parsedTime === null && right.parsedTime !== null) return 1;
      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

/** Pick the newest mapped status from Waslah tracking events. */
export function resolveLatestWaslahAppStatus(events = []) {
  const ordered = sortWaslahEventsNewestFirst(events);
  for (const event of ordered) {
    const mapped = mapWaslahTrackingToOrderStatus({
      subtag: event?.subtag,
      message: event?.remarks || event?.status,
      subtagMessage: event?.status,
    });
    if (mapped) return mapped;
  }
  return null;
}

export function getWaslahSubtagLabel(subtag = '') {
  const key = String(subtag || '').trim();
  const labels = {
    PickupRequested_001: 'Pickup Requested',
    LabelGenerated_001: 'Label Generated',
    NewShipment_001: 'New Shipment',
    Delivered_001: 'Delivered',
    OutForDelivery_001: 'Out for Delivery',
    PickedUp_002: 'Picked Up',
    InTransit_001: 'In Transit',
    InTransit_002: 'In Transit',
    Cancelled_001: 'Cancelled',
  };
  if (labels[key]) return labels[key];

  const status = mapWaslahSubtagToOrderStatus(key);
  if (status === 'OUT_FOR_DELIVERY') return 'Out for Delivery';
  if (status === 'DELIVERED') return 'Delivered';
  if (status === 'SHIPPED') return 'Shipped / In Transit';
  if (status === 'PICKED_UP') return 'Picked Up';
  if (status === 'PICKUP_REQUESTED') return 'Pickup Requested';
  if (status === 'PROCESSING') return 'Processing';
  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'RTO') return 'Return to Shipper';
  if (status === 'RETURN') return 'Customer Return';
  return key.replace(/_/g, ' ');
}

export function buildEmxTrackingUrl(trackingNumber = '') {
  const awb = String(trackingNumber || '').trim();
  if (!awb) return '';
  return `https://www.emx.ae/all-services/track-a-package?trackingnumber=${encodeURIComponent(awb)}`;
}

export function isWaslahCourierOrder(order = {}) {
  const courier = String(order?.courier || '').toLowerCase();
  return (
    courier.includes('emx')
    || courier.includes('waslah')
    || Boolean(order?.waslah?.orderId || order?.waslah?.trackingNumber)
  );
}

function unwrapWaslahHistoryList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.history)) return payload.data.history;
  if (Array.isArray(payload?.data?.events)) return payload.data.events;
  if (Array.isArray(payload?.history)) return payload.history;
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.tracking_history)) return payload.tracking_history;
  return [];
}

function unwrapWaslahCurrentTrackingStatus(payload = {}) {
  const candidates = [
    payload?.tracking_status,
    payload?.trackingStatus,
    payload?.current_tracking_status,
    payload?.currentTrackingStatus,
    payload?.current_status,
    payload?.currentStatus,
    payload?.last_status,
    payload?.lastStatus,
    payload?.order?.tracking_status,
    payload?.order?.trackingStatus,
    payload?.data?.tracking_status,
    payload?.data?.trackingStatus,
  ];

  const candidate = candidates.find((entry) => entry && (typeof entry === 'object' || typeof entry === 'string'));
  if (!candidate) return null;
  if (typeof candidate === 'string') {
    return { status: candidate, subtag_message: candidate };
  }
  return candidate;
}

function normalizeWaslahEvent(entry = {}, { authoritative = false } = {}) {
  const subtag = getWaslahEventSubtag(entry);
  const statusLabel = entry?.subtag_message
    || entry?.subtagMessage
    || entry?.message
    || entry?.Message
    || entry?.Status
    || entry?.status?.descriptionEn
    || entry?.status?.description
    || (typeof entry?.status === 'string' ? entry.status : '')
    || getWaslahSubtagLabel(subtag)
    || 'Update';

  return {
    time: getWaslahEventTime(entry),
    status: statusLabel,
    subtag,
    location: entry?.location
      || entry?.city
      || entry?.checkpoint_location
      || entry?.locationEn
      || '',
    remarks: entry?.message
      || entry?.Message
      || entry?.remarks
      || entry?.Remarks
      || entry?.subtag_message
      || entry?.subtagMessage
      || '',
    ...(authoritative ? { authoritative: true } : {}),
  };
}

/** Normalize Waslah POST /orders/history into the app's unified tracking shape. */
export function normalizeWaslahTrackingHistory(payload, fallbackAwb = '') {
  const list = sortWaslahEventsNewestFirst(unwrapWaslahHistoryList(payload));
  const currentTrackingStatus = unwrapWaslahCurrentTrackingStatus(payload);
  const trackingId = String(
    fallbackAwb
    || payload?.tracking_number
    || payload?.trackingNumber
    || '',
  ).trim();

  if (!list.length && !currentTrackingStatus && !trackingId) return null;

  const events = list.map(normalizeWaslahEvent);
  const latest = currentTrackingStatus || list[0] || {};
  const latestSubtag = getWaslahEventSubtag(latest);
  const currentEvent = normalizeWaslahEvent(latest, { authoritative: Boolean(currentTrackingStatus) });
  const currentEventAlreadyIncluded = events.some((event) => (
    event.subtag === currentEvent.subtag
    && event.status === currentEvent.status
    && event.remarks === currentEvent.remarks
  ));
  if (currentTrackingStatus && currentEvent.subtag && !currentEventAlreadyIncluded) {
    events.unshift(currentEvent);
  }

  const appStatus = mapWaslahTrackingToOrderStatus({
    subtag: latestSubtag,
    message: getWaslahEventMessage(latest),
    subtagMessage: latest?.subtag_message || latest?.subtagMessage,
  })
    || resolveLatestWaslahAppStatus(events)
    || null;
  const currentStatus = latest?.subtag_message
    || latest?.subtagMessage
    || latest?.message
    || latest?.Message
    || latest?.Status
    || latest?.status?.descriptionEn
    || latest?.status?.description
    || (typeof latest?.status === 'string' ? latest.status : '')
    || getWaslahSubtagLabel(latestSubtag)
    || '';

  return {
    courier: 'EMX',
    trackingId,
    trackingUrl: buildEmxTrackingUrl(trackingId),
    waslah: {
      trackingNumber: trackingId,
      currentStatus,
      currentSubtag: latestSubtag,
      currentEventAt: currentEvent.time || events[0]?.time || '',
      lastSubtagMessage: currentStatus,
      lastLocation: currentEvent.location || events[0]?.location || '',
      appStatus,
      events,
      isDelivered: latestSubtag === 'Delivered_001' || appStatus === 'DELIVERED',
    },
  };
}

export async function fetchNormalizedWaslahTracking(trackingNumber) {
  const { fetchWaslahTrackingHistory, isWaslahConfigured } = await import('./waslah');
  if (!isWaslahConfigured()) {
    throw new Error('Waslah is not configured');
  }
  const payload = await fetchWaslahTrackingHistory(trackingNumber);
  return normalizeWaslahTrackingHistory(payload, trackingNumber);
}
