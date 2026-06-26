function normalizeText(value = '') {
  return String(value || '').trim()
}

export function looksLikeOrderItemsJson(value = '') {
  const raw = normalizeText(value)
  return raw.startsWith('[{') || raw.startsWith('[{"')
}

export function repairJsonCandidate(raw = '') {
  return String(raw)
    .trim()
    .replace(/\\(\d)/g, '$1')
    .replace(/\\"/g, '"')
    .replace(/"\s*,\s*"quantity"/g, '","quantity"')
}

function mapParsedItem(item = {}) {
  return {
    name: normalizeText(item?.name || item?.productName || item?.title),
    sku: normalizeText(item?.sku || item?.SKU),
    price: Number(item?.price) || 0,
    quantity: Math.max(1, Number(item?.quantity) || 1),
    woocommerceProductId: normalizeText(item?.woocommerceProductId || item?.productId || item?.woocommerceproductid),
    legacySourceId: normalizeText(item?.legacySourceId || item?.legacysourceid),
  }
}

function isUsableItem(item = {}) {
  const name = normalizeText(item.name)
  if (!name || looksLikeOrderItemsJson(name)) return false
  if (/^\d+(\.\d+)?$/.test(name)) return false
  return name.length >= 2
}

export function parseEmbeddedOrderItemsJson(value = '') {
  const raw = normalizeText(value)
  if (!raw || !looksLikeOrderItemsJson(raw)) return []

  const candidates = [raw, repairJsonCandidate(raw)]
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (!Array.isArray(parsed)) continue
      return parsed.map(mapParsedItem).filter(isUsableItem)
    } catch {
      // try next candidate
    }
  }

  const scraped = []
  const objectChunks = raw.match(/\{[^{}]*"name"\s*:[^{}]*\}/g) || []

  for (const chunk of objectChunks) {
    const nameMatch = chunk.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/)
    if (!nameMatch) continue

    const name = nameMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\(\d)/g, '$1')
      .replace(/\\/g, '')
      .replace(/"+$/g, '')
      .trim()

    const priceMatch = chunk.match(/"price"\s*:\s*([\d.]+)/)
    const qtyMatch = chunk.match(/"quantity"\s*:\s*(\d+)/)
    const skuMatch = chunk.match(/"sku"\s*:\s*"([^"]*)"/)
    const legacyMatch = chunk.match(/"legacySourceId"\s*:\s*"([^"]*)"/)
    const wcMatch = chunk.match(/"woocommerceProductId"\s*:\s*"([^"]*)"/)

    const item = mapParsedItem({
      name,
      price: priceMatch ? Number(priceMatch[1]) : 0,
      quantity: qtyMatch ? Number(qtyMatch[1]) : 1,
      sku: skuMatch?.[1] || '',
      legacySourceId: legacyMatch?.[1] || '',
      woocommerceProductId: wcMatch?.[1] || '',
    })

    if (isUsableItem(item)) scraped.push(item)
  }

  return scraped
}

/** Flatten order lines where CSV import stored JSON in item.name */
export function normalizeImportedOrderItems(items = []) {
  if (!Array.isArray(items) || !items.length) return []

  const normalized = []

  for (const item of items) {
    const rawName = normalizeText(item?.name || item?.productName || '')
    if (looksLikeOrderItemsJson(rawName)) {
      const parsedItems = parseEmbeddedOrderItemsJson(rawName)
      if (parsedItems.length) {
        parsedItems.forEach((parsed) => {
          normalized.push({
            ...item,
            ...parsed,
            name: parsed.name,
            price: parsed.price || Number(item?.price) || 0,
            quantity: parsed.quantity || Number(item?.quantity) || 1,
            productId: item?.productId || undefined,
          })
        })
        continue
      }
    }

    normalized.push(item)
  }

  return normalized.filter((item) => isUsableItem(item) || normalizeText(item?.name))
}

export function collectOrderItemsFromImportRow(pick, total = 0) {
  const sources = [
    pick('orderItems', 'lineItems', 'lineitems'),
    pick('productName', 'productNames', 'productsSummary'),
    pick('lineItems'),
  ].map(normalizeText).filter(Boolean)

  for (const source of sources) {
    const parsed = parseEmbeddedOrderItemsJson(source)
    if (parsed.length) return parsed
  }

  return []
}
