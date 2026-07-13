/** Helpers for Waslah / EMX shipping label and receipt downloads. */

export function isWaslahLabelReadyOrder(order = {}) {
  const waslahOrderId = String(order?.waslah?.orderId || '').trim();
  if (!waslahOrderId) return false;

  const awb = String(order?.waslah?.trackingNumber || order?.trackingId || '').trim();
  return Boolean(awb);
}

export function isWaslahLabelNotPrinted(order = {}) {
  return isWaslahLabelReadyOrder(order) && !order?.waslah?.labelPrintedAt;
}

export function isWaslahLabelPrinted(order = {}) {
  return isWaslahLabelReadyOrder(order) && Boolean(order?.waslah?.labelPrintedAt);
}

export function getWaslahOrderIdsFromOrders(orders = []) {
  return [...new Set(
    orders
      .filter(isWaslahLabelReadyOrder)
      .map((order) => String(order.waslah.orderId).trim())
      .filter(Boolean),
  )];
}

export function extractWaslahPrintReceiptUrl(printResult) {
  if (!printResult) return null;
  if (typeof printResult === 'string' && /^https?:\/\//i.test(printResult)) {
    return printResult.trim();
  }

  const candidates = [
    printResult.url,
    printResult.pdf_url,
    printResult.receipt_url,
    printResult.file_url,
    printResult.data?.url,
    printResult.data?.pdf_url,
    printResult.data?.receipt_url,
    printResult.file?.url,
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || null;
}
