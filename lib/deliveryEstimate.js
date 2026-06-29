/**
 * Delivery estimate that skips Sundays (no deliveries on Sunday).
 * Each Sunday between order day and tentative arrival adds one extra calendar day.
 */
export function getAdjustedDeliveryDate(orderDate, deliveryDays) {
  const start = new Date(orderDate);
  start.setHours(0, 0, 0, 0);

  const baseDays = Math.max(1, Number(deliveryDays) || 1);
  const tentative = new Date(start);
  tentative.setDate(tentative.getDate() + baseDays);

  let sundays = 0;
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= tentative) {
    if (cursor.getDay() === 0) sundays += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  const displayDays = baseDays + sundays;
  const arrival = new Date(start);
  arrival.setDate(arrival.getDate() + displayDays);

  return { baseDays, displayDays, arrival, sundaysSkipped: sundays };
}

export function formatDeliveryRangeText(startDate, endDate, locale) {
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const startMonth = startDate.toLocaleDateString(locale, { month: 'short' });
  const endMonth = endDate.toLocaleDateString(locale, { month: 'short' });

  if (startDate.getTime() === endDate.getTime()) {
    return `${startDay} ${startMonth}`;
  }
  if (startMonth === endMonth) {
    return `${startDay}-${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}
