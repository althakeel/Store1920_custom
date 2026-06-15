import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import connectDB from '@/lib/mongodb'
import authSeller from '@/middlewares/authSeller'
import { getAuth } from '@/lib/firebase-admin'
import Order from '@/models/Order'
import Product from '@/models/Product'
import User from '@/models/User'
import { allocateShortOrderNumber, syncOrderCounterFloor } from '@/lib/orderNumber'

export const runtime = 'nodejs'

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

function parseDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
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
    pick.fuzzy('description', 'note', 'productname', 'products', 'productdetails')
      || pick('description', 'note', 'productName'),
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

async function attachProductsToItems(items, storeId) {
  const enriched = []

  for (const item of items) {
    const next = { ...item }
    let product = null

    if (next.sku) {
      product = await Product.findOne({ storeId, sku: next.sku }).select('_id name images price').lean()
    }

    if (!product && next.name) {
      product = await Product.findOne({
        storeId,
        name: new RegExp(`^${escapeRegex(next.name)}$`, 'i'),
      }).select('_id name images price').lean()
    }

    if (product) {
      next.productId = product._id
      if (!next.price) next.price = product.price || 0
      if (!next.name) next.name = product.name
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
  const legacySourceId = normalizeText(pick('legacySourceId', 'csvSourceId', 'sourceId'))

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

  if (!order) {
    order = new Order({ storeId })
  }

  const codAmount = parseNumber(pick('cod'), null)
  const valueAmount = parseNumber(pick('value'), null)
  const explicitTotal = parseNumber(pick('total', 'amount', 'orderTotal'), null)
  const total = explicitTotal ?? (codAmount || valueAmount || order.total || 0)

  const paymentMethod = normalizeText(pick.fuzzy(
    'paymentMethod',
    'paymentType',
    'payment',
  ) || pick('paymentMethod', 'paymentType'))

  let orderItems = parseOrderItems(pick('orderItems', 'lineItems'))
  if (!orderItems.length) {
    orderItems = buildFallbackOrderItems(pick, total)
  }
  if (orderItems.length) {
    orderItems = await attachProductsToItems(orderItems, storeId)
  }

  const shippingAddress = buildShippingAddress(pick, customerName, customerEmail, customerPhone)

  order.legacySourceId = legacySourceId || order.legacySourceId || null
  order.userId = userId || order.userId || undefined
  order.total = total
  order.shippingFee = parseNumber(pick('shippingFee', 'deliveryFee'), order.shippingFee || 0)
  order.status = normalizeText(pick('status') || order.status || 'ORDER_PLACED').toUpperCase()
  order.paymentMethod = paymentMethod || order.paymentMethod
  order.paymentStatus = normalizeText(pick('paymentStatus') || order.paymentStatus || (order.isPaid ? 'PAID' : 'Pending'))
  order.isPaid = parseBoolean(pick('isPaid', 'paid'), order.isPaid)
  order.isGuest = pick('isGuest') !== '' ? parseBoolean(pick('isGuest'), !userId) : !userId

  if (customerName) order.guestName = customerName
  if (customerEmail) order.guestEmail = customerEmail
  if (customerPhone) order.guestPhone = customerPhone

  order.trackingId = normalizeText(pick('trackingId', 'awb', 'trackingNumber') || order.trackingId)
  order.trackingUrl = normalizeText(pick('trackingUrl', 'trackingLink') || order.trackingUrl)
  order.courier = normalizeText(pick('courier', 'courierName', 'couriertype') || order.courier)
  order.notes = normalizeText(pick('notes', 'note') || order.notes)

  if (Object.keys(shippingAddress).length > 0) {
    order.shippingAddress = shippingAddress
    order.markModified('shippingAddress')
  }

  if (orderItems.length) {
    order.orderItems = orderItems
    order.markModified('orderItems')

    if (!order.total) {
      order.total = orderItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0)
    }
  }

  const createdAt = parseDate(pick('createdAt', 'orderDate', 'date'))
  const updatedAt = parseDate(pick('updatedAt'))

  await order.save()

  if (!order.shortOrderNumber) {
    if (Number.isFinite(shortOrderNumber)) {
      order.shortOrderNumber = shortOrderNumber
      await syncOrderCounterFloor(storeId, shortOrderNumber)
    } else {
      order.shortOrderNumber = await allocateShortOrderNumber(storeId)
    }
  } else if (Number.isFinite(shortOrderNumber) && shortOrderNumber >= order.shortOrderNumber) {
    order.shortOrderNumber = shortOrderNumber
    await syncOrderCounterFloor(storeId, shortOrderNumber)
  }

  if (createdAt) {
    order.createdAt = createdAt
  }
  if (updatedAt) {
    order.updatedAt = updatedAt
  }

  await order.save()

  return order
}

export async function POST(request) {
  try {
    const storeId = await getStoreIdFromRequest(request)
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
      return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]

    if (!sheetName) {
      return NextResponse.json({ error: 'No worksheet found in CSV file' }, { status: 400 })
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
    if (!rows.length) {
      return NextResponse.json({ error: 'No order rows found in CSV file' }, { status: 400 })
    }

    let created = 0
    let updated = 0
    let failed = 0
    const failures = []

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {}
      const rowNumber = index + 2

      try {
        const rowMap = buildNormalizedRowMap(row)
        const beforeOrderId = normalizeText(pickRowValue(rowMap, 'orderId', '_id'))
        const beforeShortOrderNumber = parseNumber(pickRowValue(rowMap, 'shortOrderNumber', 'orderNumber'), null)

        const existing = beforeOrderId
          ? await Order.findOne({ _id: beforeOrderId, storeId })
          : Number.isFinite(beforeShortOrderNumber)
            ? await Order.findOne({ shortOrderNumber: beforeShortOrderNumber, storeId })
            : null

        await importOrderRow(row, storeId)
        if (existing) {
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

    return NextResponse.json({
      message: 'Order CSV import completed',
      summary: {
        totalRows: rows.length,
        created,
        updated,
        failed,
      },
      failures: failures.slice(0, 100),
    })
  } catch (error) {
    console.error('[store orders csv POST] error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to import orders CSV' }, { status: 500 })
  }
}
