import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Category from '@/models/Category'
import Store from '@/models/Store'

function normalizeText(value = '') {
  return String(value || '').trim()
}

function slugify(value = '') {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function getMigrationTokenFromRequest(request, body = {}) {
  const headerToken = normalizeText(request.headers.get('x-migration-token'))
  if (headerToken) return headerToken

  const authHeader = normalizeText(request.headers.get('authorization'))
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return normalizeText(authHeader.slice(7))
  }

  const queryToken = normalizeText(new URL(request.url).searchParams.get('migrationToken'))
  if (queryToken) return queryToken

  const bodyToken = normalizeText(body?.migrationToken)
  if (bodyToken) return bodyToken

  return ''
}

async function ensureUniqueSlug(baseSlug, legacySourceId) {
  const safeBase = slugify(baseSlug) || `import-${Date.now()}`
  let candidate = safeBase
  let counter = 1

  while (true) {
    const existing = await Category.findOne({ slug: candidate }).lean()
    if (!existing) return candidate
    if (legacySourceId && normalizeText(existing.legacySourceId) === normalizeText(legacySourceId)) {
      return candidate
    }
    counter += 1
    candidate = `${safeBase}-${counter}`
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))

    const expectedToken = normalizeText(process.env.WP_MIGRATION_TOKEN || process.env.MIGRATION_SHARED_TOKEN)
    if (!expectedToken) {
      return NextResponse.json(
        { error: 'Server migration token is not configured (WP_MIGRATION_TOKEN).' },
        { status: 500 }
      )
    }

    const providedToken = getMigrationTokenFromRequest(request, body)
    if (!providedToken || providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeUsername = normalizeText(body?.storeUsername).toLowerCase()
    const incomingCategories = Array.isArray(body?.categories) ? body.categories : []

    if (!storeUsername) {
      return NextResponse.json({ error: 'storeUsername is required' }, { status: 400 })
    }

    if (!incomingCategories.length) {
      return NextResponse.json({ error: 'categories array is required' }, { status: 400 })
    }

    await connectDB()

    const store = await Store.findOne({ username: storeUsername }).lean()
    if (!store?._id) {
      return NextResponse.json({ error: `Store not found for username: ${storeUsername}` }, { status: 404 })
    }

    const storeId = String(store._id)
    const idMap = new Map()
    let created = 0
    let updated = 0
    let skipped = 0

    for (const item of incomingCategories) {
      const externalId = normalizeText(item?.externalId)
      const name = normalizeText(item?.name)
      const sourceSlug = normalizeText(item?.slug)

      if (!externalId || !name) {
        skipped += 1
        continue
      }

      const legacySourceId = `wp:product_cat:${externalId}`
      const existing = await Category.findOne({ legacySourceId, storeId })
      const slug = existing?.slug || await ensureUniqueSlug(sourceSlug || name, legacySourceId)

      const saved = await Category.findOneAndUpdate(
        { legacySourceId, storeId },
        {
          $set: {
            name,
            slug,
            description: normalizeText(item?.description),
            image: normalizeText(item?.image),
            url: normalizeText(item?.url),
            storeId,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )

      if (existing) updated += 1
      else created += 1

      idMap.set(externalId, String(saved._id))
    }

    for (const item of incomingCategories) {
      const externalId = normalizeText(item?.externalId)
      const parentExternalId = normalizeText(item?.parentExternalId)
      if (!externalId) continue

      const categoryId = idMap.get(externalId)
      if (!categoryId) continue

      const parentId = parentExternalId ? (idMap.get(parentExternalId) || null) : null
      await Category.updateOne({ _id: categoryId }, { $set: { parentId } })
    }

    return NextResponse.json({
      message: 'WordPress categories imported successfully',
      summary: {
        storeUsername,
        received: incomingCategories.length,
        created,
        updated,
        skipped,
      },
    })
  } catch (error) {
    console.error('[wp-categories migration POST] error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to import categories' }, { status: 500 })
  }
}
