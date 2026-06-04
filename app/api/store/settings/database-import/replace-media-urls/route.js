import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { getAuth } from '@/lib/firebase-admin'
import authSeller from '@/middlewares/authSeller'
import Product from '@/models/Product'

function normalizeBaseUrl(value = '') {
  return String(value || '').trim().replace(/\/+$/, '')
}

function replaceInString(value, oldBaseUrl, newBaseUrl) {
  const current = String(value || '')
  if (!current) return { changed: false, value: current }

  const oldLower = oldBaseUrl.toLowerCase()
  const currentLower = current.toLowerCase()
  if (!currentLower.startsWith(oldLower)) {
    return { changed: false, value: current }
  }

  const suffix = current.slice(oldBaseUrl.length)
  const nextValue = `${newBaseUrl}${suffix}`
  return {
    changed: nextValue !== current,
    value: nextValue,
  }
}

function replaceBaseUrlDeep(input, oldBaseUrl, newBaseUrl) {
  if (typeof input === 'string') {
    const result = replaceInString(input, oldBaseUrl, newBaseUrl)
    return {
      value: result.value,
      urlReplacements: result.changed ? 1 : 0,
    }
  }

  if (Array.isArray(input)) {
    let urlReplacements = 0
    const value = input.map((item) => {
      const replaced = replaceBaseUrlDeep(item, oldBaseUrl, newBaseUrl)
      urlReplacements += replaced.urlReplacements
      return replaced.value
    })

    return { value, urlReplacements }
  }

  if (input && typeof input === 'object') {
    let urlReplacements = 0
    const value = {}

    for (const [key, child] of Object.entries(input)) {
      const replaced = replaceBaseUrlDeep(child, oldBaseUrl, newBaseUrl)
      value[key] = replaced.value
      urlReplacements += replaced.urlReplacements
    }

    return { value, urlReplacements }
  }

  return { value: input, urlReplacements: 0 }
}

async function getStoreIdFromRequest(request) {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const idToken = authHeader.replace('Bearer ', '')
  const decodedToken = await getAuth().verifyIdToken(idToken)
  return authSeller(decodedToken.uid)
}

export async function POST(request) {
  try {
    const storeId = await getStoreIdFromRequest(request)
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const oldBaseUrl = normalizeBaseUrl(body?.oldBaseUrl)
    const newBaseUrl = normalizeBaseUrl(body?.newBaseUrl)
    const dryRun = Boolean(body?.dryRun)

    if (!oldBaseUrl || !newBaseUrl) {
      return NextResponse.json({ error: 'oldBaseUrl and newBaseUrl are required' }, { status: 400 })
    }

    if (oldBaseUrl.toLowerCase() === newBaseUrl.toLowerCase()) {
      return NextResponse.json({ error: 'oldBaseUrl and newBaseUrl cannot be the same' }, { status: 400 })
    }

    await connectDB()

    const storeIdString = String(storeId)
    const products = await Product.find({ storeId: storeIdString }).lean()

    let scanned = 0
    let updated = 0
    let urlReplacements = 0

    for (const product of products) {
      scanned += 1

      const imagesResult = replaceBaseUrlDeep(product.images || [], oldBaseUrl, newBaseUrl)
      const externalImagesResult = replaceBaseUrlDeep(product.externalImages || [], oldBaseUrl, newBaseUrl)
      const variantsResult = replaceBaseUrlDeep(product.variants || [], oldBaseUrl, newBaseUrl)

      const productReplacements = imagesResult.urlReplacements + externalImagesResult.urlReplacements + variantsResult.urlReplacements
      if (!productReplacements) continue

      urlReplacements += productReplacements
      updated += 1

      if (!dryRun) {
        await Product.updateOne(
          { _id: product._id },
          {
            $set: {
              images: imagesResult.value,
              externalImages: externalImagesResult.value,
              variants: variantsResult.value,
            },
          }
        )
      }
    }

    return NextResponse.json({
      message: dryRun
        ? 'Dry run completed. No records were changed.'
        : 'Media URL replacement completed.',
      summary: {
        dryRun,
        scanned,
        updated,
        urlReplacements,
        oldBaseUrl,
        newBaseUrl,
      },
    })
  } catch (error) {
    console.error('[database-import replace-media-urls POST] error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to replace media URLs' }, { status: 500 })
  }
}
