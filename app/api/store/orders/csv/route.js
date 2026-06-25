import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import connectDB from '@/lib/mongodb'
import authSeller from '@/middlewares/authSeller'
import { getAuth } from '@/lib/firebase-admin'
import Order from '@/models/Order'
import Product from '@/models/Product'
import User from '@/models/User'
import { parseOrderImportBuffer } from '@/lib/parseOrderImportSheet'

export const runtime = 'nodejs'
export const maxDuration = 300

async function getStoreIdFromRequest(request) {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const idToken = authHeader.replace('Bearer ', '')
  const decodedToken = await getAuth().verifyIdToken(idToken)
  return authSeller(decodedToken.uid)
}

function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback
  const normalized = String(value).replace(/,/g, '').trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === null || value === undefined || value === '') return fallback

  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'paid'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n', 'unpaid'].includes(normalized)) return false
  return fallback
}

function normalizeText(value = '') {
  return String(value || '').trim()
}

function normalizeWcStatusSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^wc-/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function mapWoocommerceStatusToStore1920(wcStatus = '', wcLabel = '') {
  const slug = normalizeWcStatusSlug(wcStatus)
  const label = normalizeWcStatusSlug(wcLabel)
  const s = slug || label

  const exact = {
    pending: 'ORDER_PLACED',
    confirmed: 'ORDER_PLACED',
    processing: 'PROCESSING',
    'on-hold': 'ORDER_PLACED',
    completed: 'DELIVERED',
    closed: 'DELIVERED',
    cancelled: 'CANCELLED',
    refunded: 'RETURNED',
    failed: 'PAYMENT_FAILED',
    shipped: 'SHIPPED',
    paid: 'DELIVERED',
    returned: 'RETURNED',
    'return-request': 'RETURN_REQUESTED',
    'return-requested': 'RETURN_REQUESTED',
    'return-approved': 'RETURN_APPROVED',
    'return-rejected': 'PROCESSING',
    'delivery-failed': 'CANCELLED',
    'cash-on-delivery': 'ORDER_PLACED',
    cod: 'ORDER_PLACED',
    'out-for-delivery': 'OUT_FOR_DELIVERY',
  }

  if (exact[s]) return exact[s]
  if (s.includes('return')) {
    if (s.includes('reject')) return 'PROCESSING'
    if (s.includes('approv')) return 'RETURN_APPROVED'
    if (s.includes('request') || s.includes('initiat')) return 'RETURN_REQUESTED'
    return 'RETURNED'
  }
  if (s.includes('deliver') && s.includes('fail')) return 'CANCELLED'
  if (s.includes('ship')) return 'SHIPPED'
  if (s.includes('cancel')) return 'CANCELLED'
  if (s.includes('refund')) return 'RETURNED'
  if (s.includes('fail')) return 'PAYMENT_FAILED'
  if (s.includes('complet') || s.includes('closed') || s === 'paid') return 'DELIVERED'
  if (s.includes('process') || s.includes('confirm')) return 'PROCESSING'

  return ''
}

function normalizeImportedPaymentMethod(methodCode = '', methodTitle = '') {
  const code = String(methodCode || '').trim()
  const title = String(methodTitle || '').trim()
  const combined = `${code} ${title}`.trim().toLowerCase()

  if (!combined) return 'COD'

  if (combined.includes('wallet') || combined.includes('store credit') || combined.includes('store-credit')) {
    return 'WALLET'
  }
  if (combined.includes('tabby')) return 'TABBY'
  if (combined.includes('tamara')) return 'TAMARA'
  if (
    combined.includes('cod')
    || combined.includes('cash on delivery')
    || combined.includes('cash-on-delivery')
    || combined.includes('pay on delivery')
  ) {
    return 'COD'
  }
  if (combined.includes('stripe')) return 'STRIPE'
  if (combined.includes('razorpay')) return 'RAZORPAY'
  if (
    combined.includes('card')
    || combined.includes('credit')
    || combined.includes('debit')
    || combined.includes('paypal')
    || combined.includes('prepaid')
    || combined.includes('online')
    || combined.includes('apple pay')
    || combined.includes('google pay')
    || combined.includes('visa')
    || combined.includes('mastercard')
    || combined.includes('mada')
  ) {
    return 'CARD'
  }

  const upper = code.toUpperCase()
  if (['COD', 'CARD', 'STRIPE', 'TABBY', 'TAMARA', 'WALLET', 'RAZORPAY'].includes(upper)) {
    return upper
  }

  return 'COD'
}

function normalizeImportedPaymentStatusText(paymentStatus = '', isPaid = false) {
  const text = String(paymentStatus || '').trim().toLowerCase()
  if (isPaid || ['paid', 'captured', 'completed', 'success', 'succeeded'].includes(text)) {
    return 'PAID'
  }
  if (['failed', 'payment_failed', 'refunded', 'cancelled', 'canceled'].includes(text)) {
    return 'FAILED'
  }
  return 'PENDING'
}

function resolveImportedPaymentStatus({
  storeStatus,
  paymentMethod,
  isPaid,
  paymentStatus,
}) {
  const method = String(paymentMethod || '').toUpperCase()
  let paid = parseBoolean(isPaid, false)
  const statusText = String(paymentStatus || '').trim()

  if (statusText) {
    paid = ['paid', 'captured', 'completed'].includes(statusText.toLowerCase())
  }

  if (method === 'COD') {
    if (storeStatus === 'DELIVERED') paid = true
    if (['RETURNED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'CANCELLED', 'PAYMENT_FAILED'].includes(storeStatus)) {
      paid = false
    }
  }

  return {
    isPaid: paid,
    paymentStatus: normalizeImportedPaymentStatusText(paid ? 'paid' : statusText, paid),
  }
}

function parseDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e12) {
      const ms = new Date(value)
      return Number.isNaN(ms.getTime()) ? null : ms
    }
    if (value > 20000) {
      const excelEpoch = Date.UTC(1899, 11, 30)
      const parsed = new Date(excelEpoch + value * 86400000)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
  }

  const text = String(value).trim()
  if (!text) return null

  const iso = new Date(text)
  if (!Number.isNaN(iso.getTime()) && !/^0+$/.test(text.replace(/\D/g, ''))) {
    return iso
  }

  const dmy = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (dmy) {
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3])
    const parsed = new Date(
      year,
      Number(dmy[2]) - 1,
      Number(dmy[1]),
      Number(dmy[4] || 0),
      Number(dmy[5] || 0),
      Number(dmy[6] || 0),
    )
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

function normalizeRowKey(key = '') {
  return String(key)
    .replace(/^\ufeff/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function buildNormalizedRowMap(row = {}) {
  const map = new Map()

  for (const [key, value] of Object.entries(row || {})) {
    const normalizedKey = normalizeRowKey(key)
    if (!normalizedKey) continue
    if (!map.has(normalizedKey)) {
      map.set(normalizedKey, value)
    }
  }

  return map
}

function pickRowValue(rowMap, ...aliases) {
  for (const alias of aliases) {
    const value = rowMap.get(normalizeRowKey(alias))
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value
    }
  }
  return ''
}

function pickRowValueFuzzy(rowMap, ...aliases) {
  const direct = pickRowValue(rowMap, ...aliases)
  if (direct !== '') return direct

  const needles = aliases.map(normalizeRowKey).filter(Boolean)
  for (const [key, value] of rowMap.entries()) {
    if (value === undefined || value === null || String(value).trim() === '') continue
    if (needles.some((needle) => key.includes(needle) || needle.includes(key))) {
      return value
    }
  }

  return ''
}

function mergeNonEmptyObjects(...objects) {
  const merged = {}

  for (const source of objects) {
    if (!source || typeof source !== 'object') continue
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        merged[key] = value
      }
    }
  }

  return merged
}

function isLikelyProductName(value) {
  const text = normalizeText(value)
  if (!text) return false
  if (/^\d+(\.\d+)?$/.test(text)) return false
  return text.length >= 2
}

function parseOrderItems(value) {
  if (!value) return []

  const raw = String(value).trim()
  if (!isLikelyProductName(raw) && !raw.startsWith('[') && !raw.includes('|') && !raw.includes('::')) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => ({
        name: normalizeText(item?.name || item?.productName || item?.title),
        sku: normalizeText(item?.sku || item?.SKU),
        price: parseNumber(item?.price, 0),
        quantity: Math.max(1, parseNumber(item?.quantity, 1)),
        woocommerceProductId: normalizeText(item?.woocommerceProductId || item?.productId || item?.woocommerceproductid),
        legacySourceId: normalizeText(item?.legacySourceId || item?.legacysourceid),
      }))
      .filter((item) => isLikelyProductName(item.name))
  } catch {
    return raw
      .split('|')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [name, quantity, price, sku] = entry.split('::').map((part) => part.trim())
        return {
          name: normalizeText(name),
          sku: normalizeText(sku),
          quantity: Math.max(1, parseNumber(quantity, 1)),
          price: parseNumber(price, 0),
        }
      })
      .filter((item) => isLikelyProductName(item.name))
  }
}

function buildFlatOrderItem(pick) {
  const name = normalizeText(
    pick.fuzzy('productName', 'product', 'productTitle', 'itemName', 'lineItem', 'description', 'note')
      || pick('productName', 'product', 'description', 'note'),
  )

  if (!isLikelyProductName(name)) return null

  const quantity = Math.max(1, parseNumber(pick('quantity', 'qty', 'numberofpieces'), 1))
  const price = parseNumber(pick('price', 'unitPrice', 'itemPrice', 'salePrice'), 0)
  const sku = normalizeText(pick('sku', 'productSku', 'itemSku'))

  return { name, sku, quantity, price }
}

function buildFallbackOrderItems(pick, total) {
  const flatItem = buildFlatOrderItem(pick)
  if (flatItem) {
    if (!flatItem.price && total > 0) {
      flatItem.price = total / flatItem.quantity
    }
    return [flatItem]
  }

  const productName = normalizeText(
    pick.fuzzy('description', 'note', 'productname', 'products', 'productdetails', 'productnames', 'productssummary')
      || pick('description', 'note', 'productName', 'productNames', 'productsSummary'),
  )

  if (!isLikelyProductName(productName)) return []

  const quantity = Math.max(1, parseNumber(pick('numberofpieces', 'quantity', 'qty'), 1))
  const lineTotal = parseNumber(pick('value', 'cod', 'total', 'amount'), total)
  const price = lineTotal > 0 ? lineTotal / quantity : 0

  return [{ name: productName, quantity, price }]
}

function buildShippingAddress(pick, customerName, customerEmail, customerPhone) {
  const postcode = normalizeText(
    pick.fuzzy('shippingPostcode', 'postcode', 'zip', 'pincode', 'destinationflatorvillanumber')
      || pick('shippingPostcode', 'postcode', 'zip', 'pincode'),
  )

  return mergeNonEmptyObjects({
    name: normalizeText(
      pick.fuzzy('shippingName', 'receiverName', 'recieverName', 'customerName', 'customer')
        || pick('shippingName', 'receiverName', 'recieverName')
        || customerName,
    ),
    email: customerEmail,
    phone: normalizeText(
      pick.fuzzy('shippingPhone', 'receiverPhone', 'recieverPhone', 'receiverphonenumber', 'recieverphonenumber')
        || pick('shippingPhone', 'receiverPhone', 'recieverphonenumber')
        || customerPhone,
    ),
    street: normalizeText(
      pick.fuzzy('shippingAddress1', 'address1', 'street', 'destinationaddress', 'shippingaddress')
        || pick('shippingAddress1', 'address1', 'street', 'destinationaddress'),
    ),
    address2: normalizeText(pick('shippingAddress2', 'address2')),
    city: normalizeText(
      pick.fuzzy('shippingCity', 'city', 'destinationcity')
        || pick('shippingCity', 'city', 'destinationcity'),
    ),
    state: normalizeText(pick('shippingState', 'state', 'destinationstate')),
    country: normalizeText(
      pick.fuzzy('shippingCountry', 'country', 'destinationcountry')
        || pick('shippingCountry', 'country', 'destinationcountry'),
    ),
    postcode,
    zip: postcode,
    pincode: postcode,
  })
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildLegacyProductIds(item = {}) {
  const ids = new Set()
  const legacy = normalizeText(item.legacySourceId)
  const wcProductId = normalizeText(item.woocommerceProductId)

  if (legacy) {
    ids.add(legacy)
    if (legacy.startsWith('woo:')) {
      ids.add(`wc-${legacy.slice(4)}`)
    }
    if (legacy.startsWith('wc-')) {
      ids.add(`woo:${legacy.slice(3)}`)
    }
  }

  if (wcProductId) {
    ids.add(`woo:${wcProductId}`, `wc-${wcProductId}`)
  }

  return [...ids].filter(Boolean)
}

async function attachProductsToItems(items, storeId) {
  const enriched = []

  for (const item of items) {
    const next = { ...item }
    let product = null

    const legacyIds = buildLegacyProductIds(next)
    if (legacyIds.length) {
      product = await Product.findOne({
        storeId,
        legacySourceId: { $in: legacyIds },
      }).select('_id name images price legacySourceId').lean()
    }

    if (!product && next.sku) {
      product = await Product.findOne({ storeId, sku: next.sku }).select('_id name images price legacySourceId').lean()
    }

    if (!product && next.name) {
      product = await Product.findOne({
        storeId,
        name: new RegExp(`^${escapeRegex(next.name)}$`, 'i'),
      }).select('_id name images price legacySourceId').lean()
    }

    if (product) {
      next.productId = product._id
      if (!next.price) next.price = product.price || 0
      if (!next.name) next.name = product.name
      if (!next.legacySourceId) next.legacySourceId = product.legacySourceId
    }

    enriched.push(next)
  }

  return enriched
}

async function resolveUserIdFromRow(pick) {
  const email = normalizeText(pick('customerEmail', 'guestEmail', 'email', 'buyeremail'))
  if (!email) return null

  const user = await User.findOne({ email }).lean()
  return user?._id || null
}

function createRowPicker(rowMap) {
  const pick = (...aliases) => pickRowValue(rowMap, ...aliases)
  pick.fuzzy = (...aliases) => pickRowValueFuzzy(rowMap, ...aliases)
  return pick
}

async function importOrderRow(row, storeId) {
  const rowMap = buildNormalizedRowMap(row)
  const pick = createRowPicker(rowMap)

  const explicitOrderId = normalizeText(pick('orderId', '_id', 'id'))
  const shortOrderNumber = parseNumber(pick('shortOrderNumber', 'orderNumber', 'orderno'), null)
  let legacySourceId = normalizeText(pick('legacySourceId', 'csvSourceId', 'sourceId'))
  const wcOrderId = normalizeText(pick('woocommerceOrderId', 'woocommerceorderid', 'wcorderid'))
  if (!legacySourceId && wcOrderId) {
    legacySourceId = `wc-${wcOrderId}`
  }

  const customerName = normalizeText(pick.fuzzy(
    'customerName',
    'customer',
    'guestName',
    'buyername',
    'receiverName',
    'recieverName',
    'name',
  ) || pick('customerName', 'customer', 'guestName'))

  const customerEmail = normalizeText(pick('customerEmail', 'guestEmail', 'email', 'buyeremail'))
  const customerPhone = normalizeText(pick.fuzzy(
    'customerPhone',
    'guestPhone',
    'phone',
    'mobile',
    'receiverPhone',
    'recieverPhone',
    'receiverphonenumber',
    'recieverphonenumber',
  ) || pick('customerPhone', 'guestPhone', 'phone'))

  const userId = await resolveUserIdFromRow(pick)

  let order = null

  if (explicitOrderId) {
    order = await Order.findOne({ _id: explicitOrderId, storeId })
  }

  if (!order && legacySourceId) {
    order = await Order.findOne({ legacySourceId, storeId })
  }

  if (!order && Number.isFinite(shortOrderNumber)) {
    order = await Order.findOne({ shortOrderNumber, storeId })
  }

  const isExisting = Boolean(order)

  if (!order) {
    order = new Order({ storeId })
  }

  const codAmount = parseNumber(pick('cod'), null)
  const valueAmount = parseNumber(pick('value'), null)
  const explicitTotal = parseNumber(pick('total', 'amount', 'orderTotal'), null)
  const total = explicitTotal ?? (codAmount || valueAmount || 0)

  const paymentMethodRaw = normalizeText(pick.fuzzy(
    'paymentMethod',
    'paymentType',
    'payment',
  ) || pick('paymentMethod', 'paymentType'))
  const paymentMethodTitle = normalizeText(pick.fuzzy(
    'paymentMethodTitle',
    'paymentTitle',
    'paymentmethodtitle',
  ) || pick('paymentMethodTitle', 'paymentTitle'))
  const paymentMethod = normalizeImportedPaymentMethod(paymentMethodRaw, paymentMethodTitle)

  let orderItems = parseOrderItems(pick('orderItems', 'lineItems', 'lineitems'))
  if (!orderItems.length) {
    orderItems = buildFallbackOrderItems(pick, total)
  }
  if (orderItems.length) {
    orderItems = await attachProductsToItems(orderItems, storeId)
  }

  const shippingAddress = buildShippingAddress(pick, customerName, customerEmail, customerPhone)

  const isDelivered = parseBoolean(pick('isDelivered', 'delivered'), false)
  const wcStatus = normalizeText(pick('woocommerceStatus', 'woocommercestatus'))
  const wcStatusLabel = normalizeText(pick('woocommerceStatusLabel', 'woocommercestatuslabel'))

  let importedStatus = normalizeText(pick('status') || 'ORDER_PLACED').toUpperCase()
  const mappedFromWc = mapWoocommerceStatusToStore1920(wcStatus, wcStatusLabel)
  if (mappedFromWc && (importedStatus === 'ORDER_PLACED' || !pick('status'))) {
    importedStatus = mappedFromWc
  }

  const resolvedStatus = isDelivered
    && !['CANCELLED', 'RETURNED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'PAYMENT_FAILED'].includes(importedStatus)
    ? 'DELIVERED'
    : importedStatus

  const payment = resolveImportedPaymentStatus({
    storeStatus: resolvedStatus,
    paymentMethod,
    isPaid: pick('isPaid', 'paid'),
    paymentStatus: pick('paymentStatus'),
  })

  if (legacySourceId) {
    order.legacySourceId = legacySourceId
  }

  if (Number.isFinite(shortOrderNumber)) {
    order.shortOrderNumber = shortOrderNumber
    await syncOrderCounterFloor(storeId, shortOrderNumber)
  } else if (!order.shortOrderNumber) {
    order.shortOrderNumber = await allocateShortOrderNumber(storeId)
  }

  order.userId = userId || undefined
  order.total = total
  order.shippingFee = parseNumber(pick('shippingFee', 'deliveryFee'), 0)
  order.status = resolvedStatus
  order.paymentMethod = paymentMethod
  order.paymentStatus = payment.paymentStatus
  order.isPaid = payment.isPaid
  order.isGuest = pick('isGuest') !== '' ? parseBoolean(pick('isGuest'), !userId) : !userId

  const currency = normalizeText(pick('currency'))
  if (currency) {
    order.currency = currency
  }

  order.guestName = customerName
  order.guestEmail = customerEmail
  order.guestPhone = customerPhone

  order.trackingId = normalizeText(pick('trackingId', 'awb', 'trackingNumber'))
  order.trackingUrl = normalizeText(pick('trackingUrl', 'trackingLink'))
  order.courier = normalizeText(pick('courier', 'courierName', 'couriertype'))
  order.notes = normalizeText(pick('notes', 'note'))

  order.shippingAddress = shippingAddress
  order.markModified('shippingAddress')

  order.orderItems = orderItems
  order.markModified('orderItems')

  if (!order.total && orderItems.length) {
    order.total = orderItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0)
  }

  const createdAt = parseDate(pick.fuzzy(
    'createdAt',
    'orderDate',
    'datecreated',
    'ordercreated',
    'date',
    'dateCreated',
    'date_created',
    'postdate',
    'post_date',
  ) || pick('createdAt', 'orderDate', 'date'))
    || parseDate(pick('dateCompleted', 'datecompleted'))
    || parseDate(pick('datePaid', 'datepaid'))

  const updatedAt = parseDate(pick('updatedAt', 'datemodified', 'modifiedAt')) || createdAt

  if (createdAt) {
    order.createdAt = createdAt
    order.updatedAt = updatedAt || createdAt
    order.markModified('createdAt')
    order.markModified('updatedAt')
  }

  await order.save({ timestamps: !createdAt })

  return { order, isExisting }
}

function filterImportRows(rows = []) {
  return rows.filter((row) => !isImportMetadataRow(row))
}

function isImportMetadataRow(row = {}) {
  const values = Object.values(row).map((value) => String(value || '').trim())
  return values.some((value) => value.includes('EXPORT_META'))
}

async function processImportRows(rows, storeId, { rowOffset = 0 } = {}) {
  const importRows = filterImportRows(rows)
  let created = 0
  let updated = 0
  let failed = 0
  const failures = []

  for (let index = 0; index < importRows.length; index += 1) {
    const row = importRows[index] || {}
    const rowNumber = rowOffset + index + 2

    try {
      const { isExisting } = await importOrderRow(row, storeId)
      if (isExisting) {
        updated += 1
      } else {
        created += 1
      }
    } catch (error) {
      failed += 1
      failures.push({
        row: rowNumber,
        reason: error?.message || 'Failed to import order row',
      })
    }
  }

  return {
    summary: {
      totalRows: importRows.length,
      created,
      updated,
      failed,
    },
    failures: failures.slice(0, 100),
  }
}

async function parseRowsFromUpload(file) {
  const arrayBuffer = await file.arrayBuffer()
  const fileName = typeof file.name === 'string' ? file.name : ''
  return parseOrderImportBuffer(arrayBuffer, fileName)
}

export async function POST(request) {
  try {
    const storeId = await getStoreIdFromRequest(request)
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const contentType = request.headers.get('content-type') || ''
    let rows = []
    let rowOffset = 0

    if (contentType.includes('application/json')) {
      const body = await request.json()
      rows = Array.isArray(body?.rows) ? body.rows : []
      rowOffset = Math.max(0, Number(body?.rowOffset) || 0)
    } else {
      const formData = await request.formData()
      const file = formData.get('file')
      const mode = String(formData.get('mode') || 'import').trim().toLowerCase()

      if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
        return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
      }

      const parsed = await parseRowsFromUpload(file)
      const stats = parsed.stats || {}
      rows = parsed.rows || []

      if (mode === 'parse') {
        return NextResponse.json({
          message: 'Order file parsed',
          stats,
          total: rows.length,
        })
      }
    }

    if (!rows.length) {
      return NextResponse.json({ error: 'No order rows found in CSV file' }, { status: 400 })
    }

    const result = await processImportRows(rows, storeId, { rowOffset })

    return NextResponse.json({
      message: 'Order CSV import completed',
      totalParsed: rows.length,
      ...result,
    })
  } catch (error) {
    console.error('[store orders csv POST] error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to import orders CSV' }, { status: 500 })
  }
}
