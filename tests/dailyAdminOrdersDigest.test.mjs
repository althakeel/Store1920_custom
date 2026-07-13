import assert from 'node:assert/strict';
import test from 'node:test';
import { getDailyAdminDigestWindow } from '../lib/dailyAdminOrdersDigestWindow.js';

test('skips Sunday digest', () => {
  // 2026-07-12 10:00 Dubai = 06:00 UTC Sunday
  const window = getDailyAdminDigestWindow(new Date('2026-07-12T06:00:00.000Z'));
  assert.equal(window.skip, true);
  assert.equal(window.reason, 'sunday');
});

test('Monday window covers Saturday 10:00 to Monday 10:00 Dubai', () => {
  // 2026-07-13 10:00 Dubai = 06:00 UTC Monday
  const window = getDailyAdminDigestWindow(new Date('2026-07-13T06:00:00.000Z'));
  assert.equal(window.skip, false);
  assert.equal(window.startDate, '2026-07-11');
  assert.equal(window.endDate, '2026-07-13');
  assert.equal(window.start.toISOString(), '2026-07-11T06:00:00.000Z');
  assert.equal(window.end.toISOString(), '2026-07-13T06:00:00.000Z');
});

test('weekday window is previous day 10:00 to today 10:00 Dubai', () => {
  // 2026-07-14 10:00 Dubai = 06:00 UTC Tuesday
  const window = getDailyAdminDigestWindow(new Date('2026-07-14T06:00:00.000Z'));
  assert.equal(window.skip, false);
  assert.equal(window.startDate, '2026-07-13');
  assert.equal(window.endDate, '2026-07-14');
});
