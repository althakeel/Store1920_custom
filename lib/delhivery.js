import axios from "axios";

const DELHIVERY_API_TOKEN = process.env.DELHIVERY_API_TOKEN;

export async function checkPincodeServiceability(pincode) {
  const url = `https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=${pincode}`;
  const headers = { Authorization: `Token ${DELHIVERY_API_TOKEN}` };
  const { data } = await axios.get(url, { headers });
  return data;
}

export async function getExpectedTAT(origin, destination, mot = "S", pdt = "B2C", expected_pickup_date = "") {
  let url = `https://track.delhivery.com/api/dc/expected_tat?origin_pin=${origin}&destination_pin=${destination}&mot=${mot}&pdt=${pdt}`;
  if (expected_pickup_date) url += `&expected_pickup_date=${expected_pickup_date}`;
  const headers = { Authorization: `Token ${DELHIVERY_API_TOKEN}` };
  const { data } = await axios.get(url, { headers });
  return data;
}

// Add more functions for other endpoints as needed

// Get tracking details for a given Delhivery waybill (AWB)
// Docs: https://track.delhivery.com/api/#track-packages
export async function getDelhiveryTracking(waybill) {
  if (!DELHIVERY_API_TOKEN) {
    throw new Error('DELHIVERY_API_TOKEN is not set');
  }
  const url = `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}`;
  const headers = { 
    Authorization: `Token ${DELHIVERY_API_TOKEN}`,
    Accept: 'application/json'
  };
  const { data } = await axios.get(url, { headers });
  // Expected shape: { ShipmentData: [ { Shipment: { Status:{Status, StatusDateTime, StatusLocation}, Scans:[{ScanDetail:{ScanDateTime, ScanType, ScannedLocation, Scan, Instructions}}] } } ] }
  return data;
}

// Normalize Delhivery payload into a consistent shape used across the app
export function normalizeDelhiveryShipment(payload, fallbackWaybill = '') {
  // Payload may be the root response or already the Shipment object
  const shipment = payload?.ShipmentData?.[0]?.Shipment || payload?.Shipment || payload;
  if (!shipment) return null;

  const trackingId = shipment.AwbNumber || shipment.Waybill || fallbackWaybill || '';
  const statusObj = shipment.Status || {};
  const scans = Array.isArray(shipment.Scans) ? shipment.Scans : [];

  const events = scans
    .map((s) => s?.ScanDetail)
    .filter(Boolean)
    .map((d) => ({
      time: d.ScanDateTime,
      status: d.Scan || d.ScanType,
      location: d.ScannedLocation,
      remarks: d.Instructions || ''
    }))
    .sort((a, b) => new Date(b.time) - new Date(a.time));

  const dedupedEvents = [];
  const seenEvents = new Set();
  for (const event of events) {
    const key = [
      event.time ? new Date(event.time).toISOString() : '',
      String(event.status || '').trim().toLowerCase(),
      String(event.location || '').trim().toLowerCase(),
      String(event.remarks || '').trim().toLowerCase(),
    ].join('|');
    if (seenEvents.has(key)) continue;
    seenEvents.add(key);
    dedupedEvents.push(event);
  }

  // Extract payment collection information from Delhivery API
  // Delhivery returns fields like: IsCodRecovered, Amount, PaidMethod, Payment, etc.
  const paymentInfo = {
    is_cod_recovered: shipment.IsCodRecovered || shipment.is_cod_recovered || false,
    cod_amount: shipment.Amount || shipment.CodAmount || shipment.cod_amount || 0,
    payment_method: shipment.PaidMethod || shipment.PaymentMethod || shipment.payment_method || '',
    payment_status: shipment.PaymentStatus || shipment.payment_status || '',
    // Check if latest event indicates payment collected
    payment_collected_at: (() => {
      const paymentEvent = dedupedEvents.find(e => 
        e.status?.toLowerCase().includes('collect') || 
        e.status?.toLowerCase().includes('payment') ||
        e.remarks?.toLowerCase().includes('cod') ||
        e.remarks?.toLowerCase().includes('payment')
      );
      return paymentEvent?.time || null;
    })()
  };

  return {
    courier: 'Delhivery',
    trackingId,
    trackingUrl: trackingId ? `https://www.delhivery.com/track/package/${encodeURIComponent(trackingId)}` : '',
    delhivery: {
      waybill: trackingId,
      current_status: statusObj.Status,
      current_status_time: statusObj.StatusDateTime,
      current_status_location: statusObj.StatusLocation,
      expected_delivery_date: shipment.ExpectedDeliveryDate || shipment.EDD,
      origin: shipment.Origin || shipment.OriginLocation,
      destination: shipment.Destination || shipment.DestinationLocation,
      events: dedupedEvents,
      payment: paymentInfo
    }
  };
}

// Helper to fetch and normalize a Delhivery waybill in one call
export async function fetchNormalizedDelhiveryTracking(waybill) {
  const payload = await getDelhiveryTracking(waybill);
  return normalizeDelhiveryShipment(payload, waybill);
}

// Schedule a pickup with Delhivery
// Docs: https://track.delhivery.com/api/#schedule-a-pickup
export async function schedulePickup(pickupData) {
  if (!DELHIVERY_API_TOKEN) {
    throw new Error('DELHIVERY_API_TOKEN is not set');
  }

  const {
    pickupLocationId,
    expectedPackageCount,
    expectedWeight,
    pickupDate,
    pickupTimeSlot,
    instructions,
    contactName,
    contactPhone
  } = pickupData;

  const url = 'https://track.delhivery.com/api/cust/create/pickup';
  const headers = {
    Authorization: `Token ${DELHIVERY_API_TOKEN}`,
    'Content-Type': 'application/json'
  };

  const payload = {
    pickup_location_id: pickupLocationId,
    expected_package_count: expectedPackageCount,
    expected_weight_per_package: expectedWeight,
    pickup_date: pickupDate,
    pickup_time_slot: pickupTimeSlot,
    instructions,
    contact_name: contactName,
    contact_phone: contactPhone
  };

  try {
    const { data } = await axios.post(url, payload, { headers });
    return {
      success: true,
      pickupId: data.pickup_id || data.PickupId,
      message: data.message || 'Pickup scheduled successfully',
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error?.response?.data?.message || error?.message || 'Failed to schedule pickup',
      details: error?.response?.data
    };
  }
}

// Get pickup status
export async function getPickupStatus(pickupId) {
  if (!DELHIVERY_API_TOKEN) {
    throw new Error('DELHIVERY_API_TOKEN is not set');
  }

  const url = `https://track.delhivery.com/api/cust/pickup/${pickupId}`;
  const headers = {
    Authorization: `Token ${DELHIVERY_API_TOKEN}`
  };

  const { data } = await axios.get(url, { headers });
  return data;
}

// Cancel a scheduled pickup
export async function cancelPickup(pickupId) {
  if (!DELHIVERY_API_TOKEN) {
    throw new Error('DELHIVERY_API_TOKEN is not set');
  }

  const url = `https://track.delhivery.com/api/cust/pickup/${pickupId}/cancel`;
  const headers = {
    Authorization: `Token ${DELHIVERY_API_TOKEN}`
  };

  const { data } = await axios.post(url, {}, { headers });
  return data;
}
