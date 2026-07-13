import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrdersByProductDateFilter,
  buildOrdersByProductDateTime,
  getOrdersByProductBusinessDayBounds,
} from '../lib/storeOrdersByProductDates.js';

test('Dubai wall time converts to the correct UTC instant', () => {
  const date = buildOrdersByProductDateTime('2026-07-13', '10:00');
  assert.equal(date.toISOString(), '2026-07-13T06:00:00.000Z');
});

test('business day before 10:00 Dubai uses previous cutover', () => {
  const now = new Date('2026-07-13T04:00:00.000Z'); // 08:00 Dubai
  const bounds = getOrdersByProductBusinessDayBounds('10:00', now);
  assert.equal(bounds.startDate, '2026-07-12');
  assert.equal(bounds.endDate, '2026-07-13');
  assert.equal(bounds.start.toISOString(), '2026-07-12T06:00:00.000Z');
  assert.equal(bounds.end.toISOString(), '2026-07-13T06:00:00.000Z');
});

test('business day after 10:00 Dubai uses today cutover', () => {
  const now = new Date('2026-07-13T11:00:00.000Z'); // 15:00 Dubai
  const bounds = getOrdersByProductBusinessDayBounds('10:00', now);
  assert.equal(bounds.startDate, '2026-07-13');
  assert.equal(bounds.endDate, '2026-07-14');
  assert.equal(bounds.start.toISOString(), '2026-07-13T06:00:00.000Z');
  assert.equal(bounds.end.toISOString(), '2026-07-14T06:00:00.000Z');
});

test('LAST_WEEK ends at current business-day end so afternoon sales are included', () => {
  const now = new Date('2026-07-13T11:00:00.000Z'); // 15:00 Dubai
  const filter = buildOrdersByProductDateFilter('LAST_WEEK', '', '', '10:00', '10:00', now);
  assert.equal(filter.createdAt.$gte.toISOString(), '2026-07-07T06:00:00.000Z');
  assert.equal(filter.createdAt.$lt.toISOString(), '2026-07-14T06:00:00.000Z');
});
