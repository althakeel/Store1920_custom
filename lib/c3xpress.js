/**
 * C3Xpress Courier API Client
 * Docs: https://c3xapi.c3xpress.com/C3XService.svc
 */

const BASE_URL = 'https://c3xapi.c3xpress.com/C3XService.svc'

const C3X_USERNAME = process.env.C3X_USERNAME
const C3X_PASSWORD = process.env.C3X_PASSWORD
const C3X_ACCOUNT_NO = process.env.C3X_ACCOUNT_NO
const C3X_COUNTRY = process.env.C3X_COUNTRY || 'AE'

function getCredentials() {
  if (!C3X_USERNAME || !C3X_PASSWORD || !C3X_ACCOUNT_NO) {
    throw new Error('C3Xpress credentials not configured. Set C3X_USERNAME, C3X_PASSWORD, C3X_ACCOUNT_NO in .env')
  }
  return {
    UserName: C3X_USERNAME,
    Password: C3X_PASSWORD,
    AccountNo: C3X_ACCOUNT_NO,
    Country: C3X_COUNTRY,
  }
}

async function c3xPost(endpoint, body) {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`C3Xpress ${endpoint} HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  if (data.Code !== 1) {
    throw new Error(`C3Xpress ${endpoint} error: ${data.Description || 'Unknown error'} (code ${data.Code})`)
  }
  return data
}

// ─── Tracking ────────────────────────────────────────────────────────────────

/**
 * Track by C3X Airwaybill Number
 * @param {string} awb
 */
export async function trackByAWB(awb) {
  const creds = getCredentials()
  return c3xPost('Tracking', { TrackingAWB: String(awb), ...creds })
}

/**
 * Track by Shipper Reference
 * @param {string} reference
 */
export async function trackByReference(reference) {
  const creds = getCredentials()
  return c3xPost('TrackByReference', { TrackingAWB: String(reference), ...creds })
}

// ─── Normalize C3X Tracking Payload ─────────────────────────────────────────

/**
 * Normalize C3Xpress tracking response into app's unified shape
 * (mirrors normalizeDelhiveryShipment format)
 */
export function normalizeC3XShipment(data, fallbackAwb = '') {
  const shipment = Array.isArray(data?.AirwayBillTrackList) && data.AirwayBillTrackList[0]
    ? data.AirwayBillTrackList[0]
    : null

  if (!shipment) return null

  const awbNo = shipment.AirWayBillNo || fallbackAwb || ''
  const logDetails = Array.isArray(shipment.TrackingLogDetails) ? shipment.TrackingLogDetails : []

  const events = logDetails.map((entry) => ({
    time: `${entry.ActivityDate} ${entry.ActivityTime}`.trim(),
    status: entry.Status,
    location: entry.Location,
    remarks: entry.Remarks,
    deliveredTo: entry.DeliveredTo || '',
  }))

  const latestEvent = events[0] || {}
  const isDelivered = latestEvent.status === 'POD'

  // Map C3X ShipmentProgress to app status string
  const progressMap = {
    1: 'ORDER_PLACED',
    2: 'SHIPPED',
    3: 'OUT_FOR_DELIVERY',
    4: 'OUT_FOR_DELIVERY',
    5: 'DELIVERED',
  }
  const appStatus = isDelivered
    ? 'DELIVERED'
    : progressMap[shipment.ShipmentProgress] || 'SHIPPED'

  return {
    courier: 'C3Xpress',
    trackingId: awbNo,
    trackingUrl: `https://c3xpress.com/tracking?awb=${encodeURIComponent(awbNo)}`,
    c3x: {
      awbNo,
      shipperReference: shipment.ShipperReference || '',
      origin: shipment.Origin || '',
      destination: shipment.Destination || '',
      actualWeight: shipment.ActualWeight || '',
      chargeableWeight: shipment.ChargeableWeight || '',
      dimension: shipment.Dimension || '',
      shipmentProgress: shipment.ShipmentProgress,
      appStatus,
      events,
      isDelivered,
      deliveredTo: isDelivered ? (logDetails[0]?.DeliveredTo || '') : '',
    },
  }
}

/**
 * Fetch and normalize a C3X AWB tracking in one call
 */
export async function fetchNormalizedC3XTracking(awb) {
  const data = await trackByAWB(awb)
  return normalizeC3XShipment(data, awb)
}

// ─── Airwaybill Creation ─────────────────────────────────────────────────────

/**
 * Create a C3Xpress Airwaybill
 * @param {object} shipmentData - matches C3X AirwayBillData schema
 * @returns {{ AirwayBillNumber, DestinationCode }}
 */
export async function createAirwaybill(shipmentData) {
  const creds = getCredentials()
  return c3xPost('CreateAirwayBill', { AirwayBillData: shipmentData, ...creds })
}

// ─── Airwaybill PDF ───────────────────────────────────────────────────────────

/**
 * Get AWB PDF as base64
 * @param {string} awbNumber
 * @param {'LABEL'|'A4'} printType
 */
export async function getAWBPdf(awbNumber, printType = 'LABEL') {
  const creds = getCredentials()
  return c3xPost('AirwayBillPDFFormat', {
    AirwayBillNumber: String(awbNumber),
    PrintType: printType,
    RequestUser: '',
    ...creds,
  })
}

// ─── Pickup ──────────────────────────────────────────────────────────────────

/**
 * Schedule a pickup request
 * @param {object} bookingData - matches C3X BookingData schema
 * @returns {{ PickupRequestNo }}
 */
export async function scheduleC3XPickup(bookingData) {
  const creds = getCredentials()
  return c3xPost('SchedulePickup', { BookingData: bookingData, ...creds })
}

/**
 * Track a pickup by booking number
 * @param {string} bookingNo
 */
export async function trackPickup(bookingNo) {
  const creds = getCredentials()
  return c3xPost('PickupTracking', { BookingNo: String(bookingNo), ...creds })
}

// ─── Rate Calculator ─────────────────────────────────────────────────────────

/**
 * Calculate shipping rate
 * @param {{ origin, destination, weight, dimension, product, serviceType }}
 */
export async function calculateRate({ origin, destination, weight, dimension = '', product = 'XPS', serviceType = 'NOR' }) {
  const creds = getCredentials()
  return c3xPost('RateFinder', {
    Origin: origin,
    Destination: destination,
    Weight: weight,
    Dimension: dimension,
    Product: product,
    ServiceType: serviceType,
    ...creds,
  })
}
