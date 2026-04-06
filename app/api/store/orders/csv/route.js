import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import connectDB from '@/lib/mongodb'
import authSeller from '@/middlewares/authSeller'
import { getAuth } from '@/lib/firebase-admin'
import Order from '@/models/Order'
import User from '@/models/User'

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

function parseOrderItems(value) {
  if (!value) return []

  try {
    const parsed = JSON.parse(String(value))
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => ({
        name: normalizeText(item?.name || item?.productName),
        price: parseNumber(item?.price, 0),
        quantity: parseNumber(item?.quantity, 1),
      }))
      .filter((item) => item.name)
  } catch {
    return String(value)
      .split('|')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [name, quantity, price] = entry.split('::').map((part) => part.trim())
        return {
          name: normalizeText(name),
          quantity: parseNumber(quantity, 1),
          price: parseNumber(price, 0),
        }
      })
      .filter((item) => item.name)
  }
}

function buildShippingAddress(row) {
  return {
    name: normalizeText(row.shippingName || row.ShippingName || row.receiverName || row.ReceiverName),
    phone: normalizeText(row.shippingPhone || row.ShippingPhone || row.receiverPhone || row.ReceiverPhone),
    street: normalizeText(row.shippingAddress1 || row.ShippingAddress1 || row.address1 || row.Address1),
    address2: normalizeText(row.shippingAddress2 || row.ShippingAddress2 || row.address2 || row.Address2),
    city: normalizeText(row.shippingCity || row.ShippingCity || row.city || row.City),
    state: normalizeText(row.shippingState || row.ShippingState || row.state || row.State),
    country: normalizeText(row.shippingCountry || row.ShippingCountry || row.country || row.Country),
    postcode: normalizeText(row.shippingPostcode || row.ShippingPostcode || row.postcode || row.Postcode),
  }
}

async function resolveUserIdFromRow(row) {
  const email = normalizeText(row.customerEmail || row.CustomerEmail || row.email || row.Email)
  if (!email) return null

  const user = await User.findOne({ email }).lean()
  return user?._id || null
}

async function importOrderRow(row, storeId) {
  const explicitOrderId = normalizeText(row.orderId || row.OrderId || row._id)
  const shortOrderNumber = parseNumber(row.shortOrderNumber || row.ShortOrderNumber || row.orderNumber || row.OrderNumber, null)
  const legacySourceId = normalizeText(row.legacySourceId || row.LegacySourceId || row.csvSourceId || row.CsvSourceId)
  const customerName = normalizeText(row.customerName || row.CustomerName || row.guestName || row.GuestName)
  const customerEmail = normalizeText(row.customerEmail || row.CustomerEmail || row.guestEmail || row.GuestEmail)
  const customerPhone = normalizeText(row.customerPhone || row.CustomerPhone || row.guestPhone || row.GuestPhone)
  const userId = await resolveUserIdFromRow(row)

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

  order.legacySourceId = legacySourceId || order.legacySourceId || null
  order.userId = userId || order.userId || undefined
  order.total = parseNumber(row.total || row.Total, order.total || 0)
  order.shippingFee = parseNumber(row.shippingFee || row.ShippingFee, order.shippingFee || 0)
  order.status = normalizeText(row.status || row.Status || order.status || 'ORDER_PLACED').toUpperCase()
  order.paymentMethod = normalizeText(row.paymentMethod || row.PaymentMethod || order.paymentMethod)
  order.paymentStatus = normalizeText(row.paymentStatus || row.PaymentStatus || order.paymentStatus)
  order.isPaid = parseBoolean(row.isPaid || row.IsPaid, order.isPaid)
  order.isGuest = !userId
  order.guestName = customerName || order.guestName
  order.guestEmail = customerEmail || order.guestEmail
  order.guestPhone = customerPhone || order.guestPhone
  order.trackingId = normalizeText(row.trackingId || row.TrackingId || order.trackingId)
  order.trackingUrl = normalizeText(row.trackingUrl || row.TrackingUrl || order.trackingUrl)
  order.courier = normalizeText(row.courier || row.Courier || order.courier)
  order.notes = normalizeText(row.notes || row.Notes || order.notes)
  order.shippingAddress = {
    ...(order.shippingAddress || {}),
    ...buildShippingAddress(row),
  }

  const parsedItems = parseOrderItems(row.orderItems || row.OrderItems || row.items || row.Items)
  if (parsedItems.length) {
    order.orderItems = parsedItems
  }

  const createdAt = parseDate(row.createdAt || row.CreatedAt)
  const updatedAt = parseDate(row.updatedAt || row.UpdatedAt)

  await order.save()

  if (!order.shortOrderNumber) {
    if (Number.isFinite(shortOrderNumber)) {
      order.shortOrderNumber = shortOrderNumber
    } else {
      const hex = order._id.toString().slice(-6)
      order.shortOrderNumber = parseInt(hex, 16)
    }
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
        const beforeOrderId = normalizeText(row.orderId || row.OrderId || '')
        const beforeShortOrderNumber = parseNumber(row.shortOrderNumber || row.ShortOrderNumber, null)

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