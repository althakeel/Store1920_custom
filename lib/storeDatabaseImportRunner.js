import fs from 'fs'
import path from 'path'
import readline from 'readline'
import * as XLSX from 'xlsx'
import mongoose from 'mongoose'
import Category from '@/models/Category'
import Coupon from '@/models/Coupon'
import Order from '@/models/Order'
import Product from '@/models/Product'
import Rating from '@/models/Rating'
import User from '@/models/User'

const SUPPORTED_CSV_ENTITY_TYPES = new Set(['products', 'categories', 'customers', 'coupons'])

function slugify(value = '') {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback
  const normalized = String(value).replace(/,/g, '').trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === null || value === undefined || value === '') return fallback
  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'active', 'published'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n', 'inactive', 'draft'].includes(normalized)) return false
  return fallback
}

function parseStringArray(value) {
  if (!value) return []
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeText(value = '') {
  return String(value || '').trim()
}

function appendMapValue(targetMap, parentKey, childKey, value) {
  const existing = targetMap.get(parentKey) || {}
  if (existing[childKey] === undefined) {
    existing[childKey] = value
  } else if (Array.isArray(existing[childKey])) {
    existing[childKey].push(value)
  } else {
    existing[childKey] = [existing[childKey], value]
  }
  targetMap.set(parentKey, existing)
}

function ensureArray(value) {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === '') return []
  return [value]
}

function decodeSqlValue(rawValue) {
  const value = rawValue.trim()
  if (!value.length) return ''
  if (/^null$/i.test(value)) return null

  if (value.startsWith("'") && value.endsWith("'")) {
    return value
      .slice(1, -1)
      .replace(/\\0/g, '\u0000')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\')
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }

  return value
}

function splitTupleValues(tupleBody = '') {
  const values = []
  let current = ''
  let inString = false
  let previousChar = ''

  for (let index = 0; index < tupleBody.length; index += 1) {
    const char = tupleBody[index]

    if (char === "'" && previousChar !== '\\') {
      inString = !inString
      current += char
      previousChar = char
      continue
    }

    if (char === ',' && !inString) {
      values.push(decodeSqlValue(current))
      current = ''
      previousChar = char
      continue
    }

    current += char
    previousChar = char
  }

  if (current.length || tupleBody.endsWith(',')) {
    values.push(decodeSqlValue(current))
  }

  return values
}

function parseInsertTuples(valuesText = '') {
  const tuples = []
  let current = ''
  let depth = 0
  let inString = false
  let previousChar = ''

  for (let index = 0; index < valuesText.length; index += 1) {
    const char = valuesText[index]

    if (char === "'" && previousChar !== '\\') {
      inString = !inString
    }

    if (!inString && char === '(') {
      if (depth === 0) current = ''
      depth += 1
      previousChar = char
      continue
    }

    if (!inString && char === ')') {
      depth -= 1
      if (depth === 0) {
        tuples.push(splitTupleValues(current))
        current = ''
        previousChar = char
        continue
      }
    }

    if (depth > 0) {
      current += char
    }

    previousChar = char
  }

  return tuples
}

function parseInsertStatement(statement = '') {
  const match = statement.match(/INSERT\s+INTO\s+`?([a-zA-Z0-9_]+)`?\s*(?:\(([^)]*)\))?\s*VALUES\s*(.*);/is)
  if (!match) return null

  const [, tableName, columnList, valuesText] = match
  const columns = columnList
    ? columnList.split(',').map((column) => column.replace(/`/g, '').trim()).filter(Boolean)
    : []

  return {
    tableName,
    columns,
    rows: parseInsertTuples(valuesText),
  }
}

async function iterateStatementsFromFile(filePath, onStatement) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity })
  let buffer = ''

  for await (const line of reader) {
    if (!buffer && !/^\s*INSERT\s+INTO/i.test(line)) {
      continue
    }

    buffer += `${line}\n`

    if (/;\s*$/.test(line)) {
      await onStatement(buffer)
      buffer = ''
    }
  }

  if (buffer.trim()) {
    await onStatement(buffer)
  }
}

async function iterateStatementsFromText(sqlText, onStatement) {
  const matches = sqlText.match(/INSERT\s+INTO[\s\S]*?;/gi) || []
  for (const statement of matches) {
    await onStatement(statement)
  }
}

function createSqlState(prefix) {
  return {
    prefix,
    posts: new Map(),
    postMeta: new Map(),
    users: new Map(),
    userMeta: new Map(),
    terms: new Map(),
    termTaxonomy: new Map(),
    termRelationships: new Map(),
    comments: new Map(),
    commentMeta: new Map(),
    orderItems: new Map(),
    orderItemMeta: new Map(),
    wcOrders: new Map(),
    wcOrderAddresses: new Map(),
    wcOrderMeta: new Map(),
  }
}

function rowToObject(columns, values) {
  const record = {}
  columns.forEach((column, index) => {
    record[column] = values[index] ?? null
  })
  return record
}

function processInsertRecord(tableName, record, state) {
  const prefix = state.prefix

  switch (tableName) {
    case `${prefix}posts`:
      if (['product', 'shop_order', 'shop_coupon', 'page', 'attachment'].includes(String(record.post_type || ''))) {
        state.posts.set(String(record.ID), record)
      }
      break
    case `${prefix}postmeta`:
      if (record.post_id && record.meta_key) {
        appendMapValue(state.postMeta, String(record.post_id), String(record.meta_key), record.meta_value)
      }
      break
    case `${prefix}users`:
      if (record.ID) state.users.set(String(record.ID), record)
      break
    case `${prefix}usermeta`:
      if (record.user_id && record.meta_key) {
        appendMapValue(state.userMeta, String(record.user_id), String(record.meta_key), record.meta_value)
      }
      break
    case `${prefix}terms`:
      if (record.term_id) state.terms.set(String(record.term_id), record)
      break
    case `${prefix}term_taxonomy`:
      if (record.term_taxonomy_id) state.termTaxonomy.set(String(record.term_taxonomy_id), record)
      break
    case `${prefix}term_relationships`:
      if (record.object_id && record.term_taxonomy_id) {
        const current = state.termRelationships.get(String(record.object_id)) || []
        current.push(String(record.term_taxonomy_id))
        state.termRelationships.set(String(record.object_id), current)
      }
      break
    case `${prefix}comments`:
      if (record.comment_ID) state.comments.set(String(record.comment_ID), record)
      break
    case `${prefix}commentmeta`:
      if (record.comment_id && record.meta_key) {
        appendMapValue(state.commentMeta, String(record.comment_id), String(record.meta_key), record.meta_value)
      }
      break
    case `${prefix}woocommerce_order_items`:
      if (record.order_id && record.order_item_id) {
        const items = state.orderItems.get(String(record.order_id)) || []
        items.push(record)
        state.orderItems.set(String(record.order_id), items)
      }
      break
    case `${prefix}woocommerce_order_itemmeta`:
      if (record.order_item_id && record.meta_key) {
        appendMapValue(state.orderItemMeta, String(record.order_item_id), String(record.meta_key), record.meta_value)
      }
      break
    case `${prefix}wc_orders`:
      if (record.id) {
        state.wcOrders.set(String(record.id), record)
      }
      break
    case `${prefix}wc_order_addresses`:
      if (record.order_id && record.address_type) {
        appendMapValue(state.wcOrderAddresses, String(record.order_id), String(record.address_type), record)
      }
      break
    case `${prefix}wc_orders_meta`:
      if (record.order_id && record.meta_key) {
        appendMapValue(state.wcOrderMeta, String(record.order_id), String(record.meta_key), record.meta_value)
      }
      break
    default:
      break
  }
}

async function collectSqlState({ sqlText, sourceFilePath, prefix }) {
  const state = createSqlState(prefix)
  const handledTables = new Set([
    `${prefix}posts`,
    `${prefix}postmeta`,
    `${prefix}users`,
    `${prefix}usermeta`,
    `${prefix}terms`,
    `${prefix}term_taxonomy`,
    `${prefix}term_relationships`,
    `${prefix}comments`,
    `${prefix}commentmeta`,
    `${prefix}woocommerce_order_items`,
    `${prefix}woocommerce_order_itemmeta`,
    `${prefix}wc_orders`,
    `${prefix}wc_order_addresses`,
    `${prefix}wc_orders_meta`,
  ])

  const handleStatement = async (statement) => {
    const parsed = parseInsertStatement(statement)
    if (!parsed || !handledTables.has(parsed.tableName)) {
      return
    }

    for (const values of parsed.rows) {
      const record = rowToObject(parsed.columns, values)
      processInsertRecord(parsed.tableName, record, state)
    }
  }

  if (sourceFilePath) {
    await iterateStatementsFromFile(sourceFilePath, handleStatement)
  } else {
    await iterateStatementsFromText(sqlText, handleStatement)
  }

  return state
}

async function ensureUniqueSlug(model, baseSlug, extraQuery = {}, legacySourceId = null) {
  const safeBase = slugify(baseSlug) || `import-${Date.now()}`
  let candidate = safeBase
  let counter = 1

  while (true) {
    const existing = await model.findOne({ slug: candidate }).lean()
    if (!existing) return candidate
    if (legacySourceId && existing.legacySourceId === legacySourceId) return candidate
    if (Object.entries(extraQuery).every(([key, value]) => String(existing?.[key] ?? '') === String(value ?? ''))) {
      return candidate
    }
    counter += 1
    candidate = `${safeBase}-${counter}`
  }
}

async function importCategoriesFromSql(state, storeIdString, counts) {
  const productCategories = [...state.termTaxonomy.values()].filter((taxonomy) => String(taxonomy.taxonomy) === 'product_cat')
  const categoryMap = new Map()

  for (const taxonomy of productCategories) {
    const termId = String(taxonomy.term_id)
    const term = state.terms.get(termId)
    if (!term?.name) continue

    const legacySourceId = `sql:term:${termId}`
    const existing = await Category.findOne({ legacySourceId, storeId: storeIdString })
    const slug = existing?.slug || await ensureUniqueSlug(Category, term.slug || term.name, { storeId: storeIdString }, legacySourceId)

    const category = await Category.findOneAndUpdate(
      { legacySourceId, storeId: storeIdString },
      {
        $set: {
          name: normalizeText(term.name),
          slug,
          description: normalizeText(taxonomy.description),
          storeId: storeIdString,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    categoryMap.set(termId, category)
    counts.categories += 1
  }

  for (const taxonomy of productCategories) {
    const termId = String(taxonomy.term_id)
    const category = categoryMap.get(termId)
    if (!category) continue

    const parentTermId = taxonomy.parent ? String(taxonomy.parent) : ''
    const parentCategory = parentTermId ? categoryMap.get(parentTermId) : null
    if (String(category.parentId || '') !== String(parentCategory?._id || '')) {
      category.parentId = parentCategory?._id?.toString() || null
      await category.save()
    }
  }

  return categoryMap
}

async function importUsersFromSql(state, counts) {
  const userMap = new Map()

  for (const userRecord of state.users.values()) {
    const legacyId = String(userRecord.ID)
    const legacySourceId = `sql:user:${legacyId}`
    const meta = state.userMeta.get(legacyId) || {}
    const email = normalizeText(userRecord.user_email)
    const firstName = normalizeText(meta.first_name)
    const lastName = normalizeText(meta.last_name)
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || normalizeText(userRecord.display_name) || email || `Legacy User ${legacyId}`
    const phone = normalizeText(meta.billing_phone || meta.phone)

    let user = await User.findOne({ legacySourceId })
    if (!user && email) {
      user = await User.findOne({ email })
    }

    if (!user) {
      user = new User({ _id: `legacy-user-${legacyId}` })
    }

    user.legacySourceId = legacySourceId
    user.name = displayName
    if (email) user.email = email
    if (phone) user.phone = phone
    if (!user.firebaseUid) user.firebaseUid = undefined
    await user.save()
    userMap.set(legacyId, user)
    counts.customers += 1
  }

  return userMap
}

function resolveCategoryIdsForPost(postId, state, categoryMap) {
  const taxonomyIds = state.termRelationships.get(String(postId)) || []
  const categoryIds = []

  for (const taxonomyId of taxonomyIds) {
    const taxonomy = state.termTaxonomy.get(String(taxonomyId))
    if (!taxonomy || String(taxonomy.taxonomy) !== 'product_cat') continue
    const category = categoryMap.get(String(taxonomy.term_id))
    if (category?._id) categoryIds.push(category._id.toString())
  }

  return [...new Set(categoryIds)]
}

async function importProductsFromSql(state, storeIdString, categoryMap, counts) {
  const productMap = new Map()
  const posts = [...state.posts.values()].filter((post) => String(post.post_type) === 'product')

  for (const post of posts) {
    const postId = String(post.ID)
    const meta = state.postMeta.get(postId) || {}
    const legacySourceId = `sql:product:${postId}`
    const categoryIds = resolveCategoryIdsForPost(postId, state, categoryMap)
    const existing = await Product.findOne({ legacySourceId, storeId: storeIdString })
    const slug = existing?.slug || await ensureUniqueSlug(Product, post.post_name || post.post_title || `product-${postId}`, { storeId: storeIdString }, legacySourceId)

    const product = await Product.findOneAndUpdate(
      { legacySourceId, storeId: storeIdString },
      {
        $set: {
          name: normalizeText(post.post_title) || `Legacy Product ${postId}`,
          legacySourceId,
          slug,
          description: normalizeText(post.post_content),
          shortDescription: normalizeText(post.post_excerpt),
          price: parseNumber(meta._price ?? meta._regular_price, 0),
          AED: parseNumber(meta._regular_price ?? meta._price, 0),
          stockQuantity: parseNumber(meta._stock, 0),
          inStock: String(meta._stock_status || '').toLowerCase() !== 'outofstock',
          sku: normalizeText(meta._sku),
          category: categoryIds[0] || null,
          categories: categoryIds,
          images: [],
          storeId: storeIdString,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    productMap.set(postId, product)
    counts.products += 1
  }

  return productMap
}

async function importCouponsFromSql(state, storeIdString, counts) {
  const posts = [...state.posts.values()].filter((post) => String(post.post_type) === 'shop_coupon')

  for (const post of posts) {
    const postId = String(post.ID)
    const meta = state.postMeta.get(postId) || {}
    const code = normalizeText(post.post_title || post.post_name).toUpperCase()
    if (!code) continue

    await Coupon.findOneAndUpdate(
      { legacySourceId: `sql:coupon:${postId}`, storeId: storeIdString },
      {
        $set: {
          legacySourceId: `sql:coupon:${postId}`,
          code,
          title: normalizeText(post.post_title) || code,
          description: normalizeText(post.post_excerpt || post.post_content) || `Imported coupon ${code}`,
          storeId: storeIdString,
          discountType: normalizeText(meta.discount_type) === 'fixed_cart' ? 'fixed' : 'percentage',
          discountValue: parseNumber(meta.coupon_amount, 0),
          minOrderValue: parseNumber(meta.minimum_amount, 0),
          maxDiscount: parseNumber(meta.maximum_amount, undefined),
          maxUses: parseNumber(meta.usage_limit, undefined),
          usedCount: parseNumber(meta.usage_count, 0),
          expiresAt: parseDate(meta.date_expires || meta.expiry_date),
          isActive: String(post.post_status || '').toLowerCase() === 'publish',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    counts.coupons += 1
  }
}

function buildOrderItems(orderId, state, productMap) {
  const items = state.orderItems.get(String(orderId)) || []

  return items
    .map((item) => {
      const meta = state.orderItemMeta.get(String(item.order_item_id)) || {}
      const product = productMap.get(String(meta._product_id || ''))
      return {
        productId: product?._id || new mongoose.Types.ObjectId(),
        name: normalizeText(item.order_item_name) || 'Imported item',
        price: parseNumber(meta._line_total, 0),
        quantity: parseNumber(meta._qty, 1),
      }
    })
    .filter((item) => item.name)
}

function normalizeOrderStatus(status = '') {
  const normalized = normalizeText(status).toLowerCase().replace(/^wc-/, '')

  switch (normalized) {
    case 'pending':
      return 'PENDING_PAYMENT'
    case 'processing':
      return 'PROCESSING'
    case 'completed':
      return 'DELIVERED'
    case 'on-hold':
      return 'PENDING_PAYMENT'
    case 'cancelled':
      return 'CANCELLED'
    case 'refunded':
      return 'RETURNED'
    case 'failed':
      return 'PAYMENT_FAILED'
    default:
      return normalizeText(status || 'ORDER_PLACED').toUpperCase()
  }
}

async function saveImportedOrder(order, counts) {
  await order.save()

  if (!order.shortOrderNumber && order._id) {
    const hex = order._id.toString().slice(-6)
    order.shortOrderNumber = parseInt(hex, 16)
    await order.save()
  }

  counts.orders += 1
}

async function importLegacyPostOrders(state, storeIdString, userMap, productMap, counts) {
  const posts = [...state.posts.values()].filter((post) => String(post.post_type) === 'shop_order')

  for (const post of posts) {
    const postId = String(post.ID)
    const meta = state.postMeta.get(postId) || {}
    const wordpressUserId = normalizeText(meta._customer_user)
    const linkedUser = wordpressUserId ? userMap.get(wordpressUserId) : null
    const shippingAddress = {
      firstName: normalizeText(meta._shipping_first_name || meta._billing_first_name),
      lastName: normalizeText(meta._shipping_last_name || meta._billing_last_name),
      address1: normalizeText(meta._shipping_address_1 || meta._billing_address_1),
      address2: normalizeText(meta._shipping_address_2 || meta._billing_address_2),
      city: normalizeText(meta._shipping_city || meta._billing_city),
      state: normalizeText(meta._shipping_state || meta._billing_state),
      country: normalizeText(meta._shipping_country || meta._billing_country),
      postcode: normalizeText(meta._shipping_postcode || meta._billing_postcode),
      phone: normalizeText(meta._billing_phone),
    }

    let order = await Order.findOne({ legacySourceId: `sql:order:${postId}`, storeId: storeIdString })
    if (!order) {
      order = new Order({ storeId: storeIdString, legacySourceId: `sql:order:${postId}` })
    }

    order.userId = linkedUser?._id || undefined
    order.total = parseNumber(meta._order_total, 0)
    order.shippingFee = parseNumber(meta._order_shipping, 0)
    order.status = normalizeOrderStatus(post.post_status || meta._order_status || 'ORDER_PLACED')
    order.paymentMethod = normalizeText(meta._payment_method_title || meta._payment_method)
    order.paymentStatus = parseBoolean(meta._paid_date || meta._date_paid, false) ? 'paid' : normalizeText(meta._transaction_id ? 'paid' : 'pending')
    order.isPaid = order.paymentStatus === 'paid'
    order.isGuest = !linkedUser
    order.guestName = [normalizeText(meta._billing_first_name), normalizeText(meta._billing_last_name)].filter(Boolean).join(' ').trim()
    order.guestEmail = normalizeText(meta._billing_email)
    order.guestPhone = normalizeText(meta._billing_phone)
    order.shippingAddress = shippingAddress
    order.notes = normalizeText(post.post_excerpt || post.post_content)
    order.orderItems = buildOrderItems(postId, state, productMap)

    await saveImportedOrder(order, counts)
  }
}

async function importHposOrders(state, storeIdString, userMap, productMap, counts) {
  const orders = [...state.wcOrders.values()]

  for (const hposOrder of orders) {
    const orderId = String(hposOrder.id)
    const addresses = state.wcOrderAddresses.get(orderId) || {}
    const billing = ensureArray(addresses.billing)[0] || {}
    const shipping = ensureArray(addresses.shipping)[0] || billing
    const meta = state.wcOrderMeta.get(orderId) || {}
    const customerId = normalizeText(hposOrder.customer_id)
    const linkedUser = customerId ? userMap.get(customerId) : null

    let order = await Order.findOne({ legacySourceId: `sql:order:${orderId}`, storeId: storeIdString })
    if (!order) {
      order = new Order({ storeId: storeIdString, legacySourceId: `sql:order:${orderId}` })
    }

    order.userId = linkedUser?._id || undefined
    order.total = parseNumber(hposOrder.total_amount ?? meta.total_amount ?? meta._order_total, 0)
    order.shippingFee = parseNumber(hposOrder.shipping_total_amount ?? meta.shipping_total_amount ?? meta._order_shipping, 0)
    order.status = normalizeOrderStatus(hposOrder.status || meta.status || 'ORDER_PLACED')
    order.paymentMethod = normalizeText(hposOrder.payment_method_title || hposOrder.payment_method || meta.payment_method_title || meta._payment_method_title)
    order.paymentStatus = parseBoolean(hposOrder.date_paid_gmt || meta.date_paid_gmt || meta._date_paid, false) ? 'paid' : normalizeText(hposOrder.transaction_id ? 'paid' : 'pending')
    order.isPaid = order.paymentStatus === 'paid'
    order.isGuest = !linkedUser
    order.guestName = [normalizeText(billing.first_name), normalizeText(billing.last_name)].filter(Boolean).join(' ').trim()
    order.guestEmail = normalizeText(billing.email || hposOrder.billing_email)
    order.guestPhone = normalizeText(billing.phone)
    order.shippingAddress = {
      firstName: normalizeText(shipping.first_name || billing.first_name),
      lastName: normalizeText(shipping.last_name || billing.last_name),
      address1: normalizeText(shipping.address_1 || billing.address_1),
      address2: normalizeText(shipping.address_2 || billing.address_2),
      city: normalizeText(shipping.city || billing.city),
      state: normalizeText(shipping.state || billing.state),
      country: normalizeText(shipping.country || billing.country),
      postcode: normalizeText(shipping.postcode || billing.postcode),
      phone: normalizeText(shipping.phone || billing.phone),
    }
    order.notes = normalizeText(hposOrder.customer_note || meta.customer_note)
    order.orderItems = buildOrderItems(orderId, state, productMap)

    await saveImportedOrder(order, counts)
  }
}

async function importOrdersFromSql(state, storeIdString, userMap, productMap, counts) {
  await importLegacyPostOrders(state, storeIdString, userMap, productMap, counts)
  await importHposOrders(state, storeIdString, userMap, productMap, counts)
}

async function importReviewsFromSql(state, productMap, userMap, counts) {
  const comments = [...state.comments.values()].filter((comment) => {
    const product = productMap.get(String(comment.comment_post_ID || ''))
    return product && (!comment.comment_type || String(comment.comment_type) === 'review')
  })

  for (const comment of comments) {
    const commentId = String(comment.comment_ID)
    const product = productMap.get(String(comment.comment_post_ID))
    if (!product?._id) continue

    const meta = state.commentMeta.get(commentId) || {}
    const wordpressUserId = normalizeText(comment.user_id)
    const linkedUser = wordpressUserId ? userMap.get(wordpressUserId) : null

    await Rating.findOneAndUpdate(
      { legacySourceId: `sql:comment:${commentId}` },
      {
        $set: {
          legacySourceId: `sql:comment:${commentId}`,
          productId: product._id.toString(),
          userId: linkedUser?._id || normalizeText(comment.comment_author_email) || `legacy-reviewer-${commentId}`,
          rating: parseNumber(meta.rating, 0),
          comment: normalizeText(comment.comment_content),
          review: normalizeText(comment.comment_content),
          approved: String(comment.comment_approved) === '1',
          isApproved: String(comment.comment_approved) === '1',
          customerName: normalizeText(comment.comment_author),
          customerEmail: normalizeText(comment.comment_author_email),
          createdAt: parseDate(comment.comment_date_gmt || comment.comment_date) || new Date(),
          updatedAt: parseDate(comment.comment_date_gmt || comment.comment_date) || new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    counts.reviews += 1
  }
}

function createCounts() {
  return {
    categories: 0,
    products: 0,
    customers: 0,
    orders: 0,
    reviews: 0,
    coupons: 0,
    users: 0,
    pages: 0,
    media: 0,
    skipped: 0,
  }
}

function normalizeSourceFilePath(sourceFilePath = '') {
  const cleanedPath = normalizeText(sourceFilePath).replace(/^['\"]+|['\"]+$/g, '')
  if (!cleanedPath) return ''
  return path.isAbsolute(cleanedPath) ? cleanedPath : path.resolve(process.cwd(), cleanedPath)
}

export async function runSqlStoreImport(settings, storeId) {
  const storeIdString = String(storeId)
  const counts = createCounts()
  const warnings = []
  const sourceFilePath = normalizeSourceFilePath(settings.sourceFilePath)

  if (sourceFilePath && !fs.existsSync(sourceFilePath)) {
    throw new Error(`SQL source file was not found at ${sourceFilePath}`)
  }

  if (!sourceFilePath && !normalizeText(settings.sourceSqlText)) {
    throw new Error('No SQL source is available. Upload a SQL file preview or set a server-local SQL file path.')
  }

  const state = await collectSqlState({
    sqlText: settings.sourceSqlText || '',
    sourceFilePath,
    prefix: normalizeText(settings.tablePrefix) || 'wp_',
  })

  let categoryMap = new Map()
  let userMap = new Map()
  let productMap = new Map()

  if (settings.entitySelection?.categories) {
    categoryMap = await importCategoriesFromSql(state, storeIdString, counts)
  }

  if (settings.entitySelection?.customers || settings.entitySelection?.users) {
    userMap = await importUsersFromSql(state, counts)
    if (settings.entitySelection?.users) {
      counts.users = counts.customers
    }
  }

  if (settings.entitySelection?.products) {
    if (!categoryMap.size) {
      categoryMap = await importCategoriesFromSql(state, storeIdString, counts)
    }
    productMap = await importProductsFromSql(state, storeIdString, categoryMap, counts)
  }

  if (settings.entitySelection?.coupons) {
    await importCouponsFromSql(state, storeIdString, counts)
  }

  if (settings.entitySelection?.orders) {
    if (!productMap.size) {
      if (!categoryMap.size) {
        categoryMap = await importCategoriesFromSql(state, storeIdString, counts)
      }
      productMap = await importProductsFromSql(state, storeIdString, categoryMap, counts)
    }
    if (!userMap.size) {
      userMap = await importUsersFromSql(state, counts)
    }
    await importOrdersFromSql(state, storeIdString, userMap, productMap, counts)
  }

  if (settings.entitySelection?.reviews) {
    if (!productMap.size) {
      if (!categoryMap.size) {
        categoryMap = await importCategoriesFromSql(state, storeIdString, counts)
      }
      productMap = await importProductsFromSql(state, storeIdString, categoryMap, counts)
    }
    if (!userMap.size) {
      userMap = await importUsersFromSql(state, counts)
    }
    await importReviewsFromSql(state, productMap, userMap, counts)
  }

  if (settings.entitySelection?.pages) {
    warnings.push('Pages import is not mapped yet because the current app has no dedicated page content model.')
  }

  if (settings.entitySelection?.media) {
    warnings.push('Media import is not mapped yet because the current app stores product images differently from WordPress attachments.')
  }

  return {
    counts,
    warnings,
    message: 'Legacy SQL import completed.',
  }
}

async function readRowsFromSpreadsheetFile(file) {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('No worksheet found in the uploaded CSV or spreadsheet file.')
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
  if (!rows.length) {
    throw new Error('The uploaded CSV file does not contain any rows.')
  }

  return rows
}

async function importCategoriesFromCsvRows(rows, storeIdString, counts) {
  const createdMap = new Map()

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || {}
    const name = normalizeText(row.Name || row.name)
    if (!name) {
      counts.skipped += 1
      continue
    }

    const legacySourceId = `csv:category:${index + 2}:${name.toLowerCase()}`
    const existing = await Category.findOne({ legacySourceId, storeId: storeIdString })
    const slug = existing?.slug || await ensureUniqueSlug(Category, row.Slug || row.slug || name, { storeId: storeIdString }, legacySourceId)

    const category = await Category.findOneAndUpdate(
      { legacySourceId, storeId: storeIdString },
      {
        $set: {
          name,
          slug,
          description: normalizeText(row.Description || row.description),
          image: normalizeText(row.Image || row.image),
          storeId: storeIdString,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    createdMap.set(name.toLowerCase(), category)
    counts.categories += 1
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || {}
    const name = normalizeText(row.Name || row.name).toLowerCase()
    const parentName = normalizeText(row.Parent || row.parent || row.ParentName || row.parentName).toLowerCase()
    if (!name || !parentName) continue

    const category = createdMap.get(name)
    const parent = createdMap.get(parentName)
    if (category && parent && String(category.parentId || '') !== String(parent._id || '')) {
      category.parentId = parent._id.toString()
      await category.save()
    }
  }
}

async function importProductsFromCsvRows(rows, storeIdString, counts) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || {}
    const name = normalizeText(row.Name || row.name)
    if (!name) {
      counts.skipped += 1
      continue
    }

    const categoryNames = parseStringArray(row.Categories || row.categories || row.Category || row.category)
    const categoryIds = []

    for (const categoryName of categoryNames) {
      const slug = slugify(categoryName)
      if (!slug) continue

      let category = await Category.findOne({ slug, storeId: storeIdString })
      if (!category) {
        category = await Category.create({
          name: categoryName,
          slug: await ensureUniqueSlug(Category, slug, { storeId: storeIdString }, `csv:auto-category:${slug}`),
          storeId: storeIdString,
        })
      }
      categoryIds.push(category._id.toString())
    }

    const legacySourceId = `csv:product:${index + 2}:${name.toLowerCase()}`
    const existing = await Product.findOne({ legacySourceId, storeId: storeIdString })
    const slug = existing?.slug || await ensureUniqueSlug(Product, row.Slug || row.slug || name, { storeId: storeIdString }, legacySourceId)

    await Product.findOneAndUpdate(
      { legacySourceId, storeId: storeIdString },
      {
        $set: {
          name,
          legacySourceId,
          slug,
          description: normalizeText(row.Description || row.description),
          shortDescription: normalizeText(row['Short description'] || row.shortDescription),
          price: parseNumber(row['Sale price'] || row.Price || row.price, 0),
          AED: parseNumber(row['Regular price'] || row.MRP || row.mrp || row.Price || row.price, 0),
          sku: normalizeText(row.SKU || row.sku),
          stockQuantity: parseNumber(row.Stock || row.stockQuantity || row.stock, 0),
          inStock: parseBoolean(row.InStock || row.inStock, parseNumber(row.Stock || row.stockQuantity || row.stock, 0) > 0),
          images: parseStringArray(row.Images || row.images || row.Image || row.image),
          category: categoryIds[0] || null,
          categories: [...new Set(categoryIds)],
          storeId: storeIdString,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    counts.products += 1
  }
}

async function importCustomersFromCsvRows(rows, counts) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || {}
    const email = normalizeText(row.Email || row.email)
    const name = normalizeText(row.Name || row.name || `${row.FirstName || ''} ${row.LastName || ''}`)

    if (!email && !name) {
      counts.skipped += 1
      continue
    }

    const legacySourceId = `csv:user:${index + 2}:${(email || name).toLowerCase()}`
    let user = await User.findOne({ legacySourceId })
    if (!user && email) {
      user = await User.findOne({ email })
    }

    if (!user) {
      user = new User({ _id: `legacy-csv-user-${index + 2}` })
    }

    user.legacySourceId = legacySourceId
    user.name = name || email || `Imported User ${index + 2}`
    if (email) user.email = email
    user.phone = normalizeText(row.Phone || row.phone)
    await user.save()
    counts.customers += 1
  }
}

async function importCouponsFromCsvRows(rows, storeIdString, counts) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || {}
    const code = normalizeText(row.Code || row.code).toUpperCase()
    if (!code) {
      counts.skipped += 1
      continue
    }

    const legacySourceId = `csv:coupon:${index + 2}:${code}`
    await Coupon.findOneAndUpdate(
      { legacySourceId, storeId: storeIdString },
      {
        $set: {
          legacySourceId,
          code,
          title: normalizeText(row.Title || row.title || code),
          description: normalizeText(row.Description || row.description || `Imported coupon ${code}`),
          storeId: storeIdString,
          discountType: normalizeText(row.DiscountType || row.discountType || row.Type || row.type) === 'fixed' ? 'fixed' : 'percentage',
          discountValue: parseNumber(row.DiscountValue || row.discountValue || row.Amount || row.amount, 0),
          minOrderValue: parseNumber(row.MinOrderValue || row.minOrderValue, 0),
          maxDiscount: parseNumber(row.MaxDiscount || row.maxDiscount, undefined),
          maxUses: parseNumber(row.MaxUses || row.maxUses, undefined),
          usedCount: parseNumber(row.UsedCount || row.usedCount, 0),
          expiresAt: parseDate(row.ExpiresAt || row.expiresAt || row.ExpiryDate || row.expiryDate),
          isActive: parseBoolean(row.IsActive || row.isActive, true),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    counts.coupons += 1
  }
}

export async function runCsvStoreImport(settings, storeId, file) {
  const storeIdString = String(storeId)
  const counts = createCounts()
  const warnings = []
  const entityType = normalizeText(settings.csvEntityType || 'products')

  if (!SUPPORTED_CSV_ENTITY_TYPES.has(entityType)) {
    throw new Error('CSV import currently supports products, categories, customers, and coupons.')
  }

  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    throw new Error('Upload a CSV or spreadsheet file to start CSV import.')
  }

  const rows = await readRowsFromSpreadsheetFile(file)

  if (entityType === 'products') {
    await importProductsFromCsvRows(rows, storeIdString, counts)
  }

  if (entityType === 'categories') {
    await importCategoriesFromCsvRows(rows, storeIdString, counts)
  }

  if (entityType === 'customers') {
    await importCustomersFromCsvRows(rows, counts)
  }

  if (entityType === 'coupons') {
    await importCouponsFromCsvRows(rows, storeIdString, counts)
  }

  warnings.push('CSV import currently supports one entity type per file.')

  return {
    counts,
    warnings,
    message: `CSV import completed for ${entityType}.`,
  }
}