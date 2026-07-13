import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getWaslahCourierStatus,
  isWaslahTrackingEventOlder,
  isWaslahCourierTerminal,
  mapWaslahSubtagToOrderStatus,
  mapWaslahTrackingToOrderStatus,
  normalizeWaslahTrackingHistory,
  parseWaslahTrackingTimestamp,
  resolveLatestWaslahAppStatus,
  resolveWaslahOrderStatusTransition,
  shouldPropagateWaslahStatusToOrder,
} from '../lib/waslahTracking.js';

const AWB = '62007200700841';
const newShipment = {
  checkpoint_time: '2026-07-13T06:10:57.313Z',
  subtag: 'NewShipment_001',
  subtag_message: 'New Shipment',
  message: 'Shipment information received',
};
const cancelled = {
  checkpoint_time: '2026-07-13T06:14:54.323Z',
  subtag: 'Cancelled_001',
  subtag_message: 'Cancelled',
  message: 'Shipment cancelled by seller',
};

for (const [name, data] of [
  ['newest-first', [cancelled, newShipment]],
  ['oldest-first', [newShipment, cancelled]],
]) {
  test(`normalizes ${name} Waslah history using event timestamps`, () => {
    const result = normalizeWaslahTrackingHistory({ tracking_number: AWB, data }, AWB);

    assert.equal(result.waslah.appStatus, 'CANCELLED');
    assert.equal(result.waslah.currentSubtag, 'Cancelled_001');
    assert.equal(result.waslah.currentStatus, 'Cancelled');
    assert.deepEqual(
      result.waslah.events.map((event) => event.subtag),
      ['Cancelled_001', 'NewShipment_001'],
    );
    assert.equal(resolveLatestWaslahAppStatus(result.waslah.events), 'CANCELLED');
  });
}

test('resolves the latest mapped status from either event direction', () => {
  const events = [cancelled, newShipment].map((entry) => ({
    time: entry.checkpoint_time,
    status: entry.subtag_message,
    subtag: entry.subtag,
    remarks: entry.message,
  }));

  assert.equal(resolveLatestWaslahAppStatus(events), 'CANCELLED');
  assert.equal(resolveLatestWaslahAppStatus([...events].reverse()), 'CANCELLED');
});

test('uses top-level tracking_status over stale history', () => {
  const result = normalizeWaslahTrackingHistory({
    tracking_number: AWB,
    tracking_status: cancelled,
    data: [newShipment],
  }, AWB);

  assert.equal(result.waslah.appStatus, 'CANCELLED');
  assert.equal(result.waslah.currentSubtag, 'Cancelled_001');
  assert.equal(result.waslah.events[0].subtag, 'Cancelled_001');
  assert.equal(resolveLatestWaslahAppStatus(result.waslah.events), 'CANCELLED');
});

test('keeps an undated top-level tracking_status authoritative over dated stale history', () => {
  const undatedCancelled = { ...cancelled };
  delete undatedCancelled.checkpoint_time;
  const result = normalizeWaslahTrackingHistory({
    tracking_number: AWB,
    tracking_status: undatedCancelled,
    data: [newShipment],
  }, AWB);

  assert.equal(result.waslah.appStatus, 'CANCELLED');
  assert.equal(result.waslah.events[0].authoritative, true);
  assert.equal(resolveLatestWaslahAppStatus(result.waslah.events), 'CANCELLED');
});

test('normalizes top-level tracking_status when history is empty', () => {
  const result = normalizeWaslahTrackingHistory({
    tracking_number: AWB,
    tracking_status: cancelled,
    data: [],
  }, AWB);

  assert.equal(result.waslah.appStatus, 'CANCELLED');
  assert.equal(result.waslah.currentStatus, 'Cancelled');
  assert.equal(result.waslah.events.length, 1);
});

for (const message of [
  'Shipment cancelled by seller',
  'Shipment canceled by seller',
  'Shipment cancellation requested',
]) {
  test(`maps cancellation text: ${message}`, () => {
    assert.equal(mapWaslahTrackingToOrderStatus({
      subtag: 'Unknown_999',
      message,
    }), 'CANCELLED');
  });
}

test('keeps the exact Waslah cancellation subtag mapping', () => {
  assert.equal(mapWaslahTrackingToOrderStatus({ subtag: 'Cancelled_001' }), 'CANCELLED');
});

test('keeps EMX cancellation as courier status without cancelling the store order', () => {
  assert.equal(shouldPropagateWaslahStatusToOrder('CANCELLED'), false);
  assert.equal(shouldPropagateWaslahStatusToOrder('SHIPPED'), true);
  assert.equal(shouldPropagateWaslahStatusToOrder('OUT_FOR_DELIVERY'), true);
  assert.equal(shouldPropagateWaslahStatusToOrder('DELIVERED'), true);
  assert.equal(resolveWaslahOrderStatusTransition('CANCELLED', 'PROCESSING'), null);
  assert.equal(resolveWaslahOrderStatusTransition('SHIPPED', 'PROCESSING'), 'SHIPPED');
  assert.equal(resolveWaslahOrderStatusTransition('SHIPPED', 'CANCELLED'), null);
  assert.equal(resolveWaslahOrderStatusTransition('RETURN', 'DELIVERED'), 'RETURN');

  const activeStoreOrderWithCancelledAwb = {
    status: 'PROCESSING',
    waslah: { lastSubtag: 'Cancelled_001', lastSubtagMessage: 'Cancelled' },
  };
  assert.equal(getWaslahCourierStatus(activeStoreOrderWithCancelledAwb), 'CANCELLED');
  assert.equal(isWaslahCourierTerminal(activeStoreOrderWithCancelledAwb), true);

  const cancelledStoreOrderWithMovingAwb = {
    status: 'CANCELLED',
    waslah: { lastSubtag: 'InTransit_001', lastSubtagMessage: 'In Transit' },
  };
  assert.equal(getWaslahCourierStatus(cancelledStoreOrderWithMovingAwb), 'SHIPPED');
  assert.equal(isWaslahCourierTerminal(cancelledStoreOrderWithMovingAwb), false);
});

test('maps the complete EMX delivery lifecycle and numeric subtag variants', () => {
  const cases = [
    ['InfoReceived_001', 'PROCESSING'],
    ['Pending_006', 'PROCESSING'],
    ['PickupRequested_001', 'PICKUP_REQUESTED'],
    ['PickedUp_002', 'PICKED_UP'],
    ['InTransit_013', 'SHIPPED'],
    ['AttemptFail_003', 'SHIPPED'],
    ['OutForDelivery_004', 'OUT_FOR_DELIVERY'],
    ['OUT_FOR_DELIVERY', 'OUT_FOR_DELIVERY'],
    ['Delivered_005', 'DELIVERED'],
    ['ToBeReturned_001', 'RTO'],
    ['Return_Received_001', 'RETURN'],
    ['Exception_012', 'CANCELLED'],
  ];

  for (const [subtag, expected] of cases) {
    assert.equal(mapWaslahSubtagToOrderStatus(subtag), expected, subtag);
  }
});

test('advances normalized history through each live delivery milestone', () => {
  const lifecycle = [
    ['NewShipment_001', 'New Shipment', 'PROCESSING'],
    ['PickupRequested_001', 'Pickup Requested', 'PICKUP_REQUESTED'],
    ['PickedUp_002', 'Picked Up', 'PICKED_UP'],
    ['InTransit_013', 'In Transit', 'SHIPPED'],
    ['OutForDelivery_004', 'Out for Delivery', 'OUT_FOR_DELIVERY'],
    ['Delivered_005', 'Delivered', 'DELIVERED'],
  ];

  lifecycle.forEach(([, , expected], index) => {
    const data = lifecycle.slice(0, index + 1).map(([subtag, message], eventIndex) => ({
      checkpoint_time: `2026-07-13T0${eventIndex + 1}:00:00.000Z`,
      subtag,
      subtag_message: message,
    }));
    const result = normalizeWaslahTrackingHistory({ tracking_number: AWB, data }, AWB);
    assert.equal(result.waslah.appStatus, expected);
    assert.equal(result.waslah.currentSubtag, lifecycle[index][0]);
  });
});

test('maps EMX human-readable lifecycle messages', () => {
  const cases = [
    ['Shipment Created', 'PROCESSING'],
    ['Pickup Requested', 'PICKUP_REQUESTED'],
    ['Shipment Picked up by Courier', 'PICKED_UP'],
    ['Shipment is in transit', 'SHIPPED'],
    ['Out for Delivery', 'OUT_FOR_DELIVERY'],
    ['Shipment Delivered', 'DELIVERED'],
    ['Undelivered - another attempt will be made', 'SHIPPED'],
    ['Shipment Returned to Sender', 'RTO'],
  ];

  for (const [message, expected] of cases) {
    assert.equal(mapWaslahTrackingToOrderStatus({ message }), expected, message);
  }
});

test('lets a specific terminal message override a generic exception subtag', () => {
  assert.equal(mapWaslahTrackingToOrderStatus({
    subtag: 'Exception',
    message: 'Shipment Returned to Sender',
  }), 'RTO');
  assert.equal(mapWaslahTrackingToOrderStatus({
    subtag: 'Exception_001',
    message: 'Shipment cancelled by carrier',
  }), 'CANCELLED');
});

test('parses and orders Dubai-local EMX timestamps', () => {
  const localized = '19/05/2023 02:51:24 PM';
  assert.equal(
    new Date(parseWaslahTrackingTimestamp(localized)).toISOString(),
    '2023-05-19T10:51:24.000Z',
  );

  const result = normalizeWaslahTrackingHistory({
    tracking_number: AWB,
    data: [
      { checkpoint_time: '19/05/2023 01:00:00 PM', subtag: 'NewShipment_001' },
      { checkpoint_time: '19/05/2023 02:00:00 PM', subtag: 'OutForDelivery_001' },
    ],
  }, AWB);
  assert.equal(result.waslah.appStatus, 'OUT_FOR_DELIVERY');
  assert.equal(result.waslah.currentSubtag, 'OutForDelivery_001');
});

test('normalizes EMX documented webhook-style field names', () => {
  const result = normalizeWaslahTrackingHistory({
    tracking_number: AWB,
    data: [{
      Time_Stamp: '2026-07-13T08:00:00.000Z',
      Status: 'Out for Delivery',
      SubStatus: 'Out for Delivery',
      Remarks: 'Courier is heading to the customer',
    }],
  }, AWB);

  assert.equal(result.waslah.appStatus, 'OUT_FOR_DELIVERY');
  assert.equal(result.waslah.currentStatus, 'Out for Delivery');
  assert.equal(result.waslah.currentEventAt, '2026-07-13T08:00:00.000Z');
});

test('does not promote an unknown courier checkpoint to shipped', () => {
  const result = normalizeWaslahTrackingHistory({
    tracking_number: AWB,
    data: [{
      checkpoint_time: '2026-07-13T08:00:00.000Z',
      subtag: 'Unknown_999',
      subtag_message: 'Custom courier scan',
    }],
  }, AWB);

  assert.equal(result.waslah.appStatus, null);
  assert.equal(result.waslah.currentStatus, 'Custom courier scan');
});

test('detects only courier checkpoints older than the stored checkpoint', () => {
  const stored = '2026-07-13T06:14:54.323Z';
  assert.equal(isWaslahTrackingEventOlder('2026-07-13T06:10:57.313Z', stored), true);
  assert.equal(isWaslahTrackingEventOlder(stored, stored), false);
  assert.equal(isWaslahTrackingEventOlder('2026-07-13T06:20:00.000Z', stored), false);
  assert.equal(isWaslahTrackingEventOlder('', stored), false);
});
