import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import authSeller from '@/middlewares/authSeller'
import { getAuth } from '@/lib/firebase-admin'
import Product from '@/models/Product'
import { ensureS3Configured } from '@/lib/storage'
import { invalidateStorefrontProductCaches } from '@/lib/cache'
import {
  countProductsNeedingImageMirror,
  fetchProductsNeedingImageMirrorBatch,
  mirrorProductRecordImages,
} from '@/lib/mirrorProductImagesToS3'

export const runtime = 'nodejs'
export const maxDuration = 300

async function getStoreIdFromRequest(request) {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const idToken = authHeader.replace('Bearer ', '')
  const decodedToken = await getAuth().verifyIdToken(idToken)
  return authSeller(decodedToken.uid)
}

export async function GET(request) {
  try {
    const storeId = await getStoreIdFromRequest(request)
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      ensureS3Configured()
    } catch (error) {
      return NextResponse.json({
        error: error?.message || 'AWS S3 is not configured on the server',
      }, { status: 503 })
    }

    await connectDB()

    const [counts, totalProducts] = await Promise.all([
      countProductsNeedingImageMirror(Product, storeId),
      Product.countDocuments({ storeId }),
    ])

    return NextResponse.json({
      totalProducts,
      productsPending: counts.productsPending,
      externalImages: counts.externalImages,
      ready: counts.productsPending > 0,
    })
  } catch (error) {
    console.error('[product remirror-images GET] error:', error)
    return NextResponse.json({
      error: error?.message || 'Failed to read image migration status',
    }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const storeId = await getStoreIdFromRequest(request)
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      ensureS3Configured()
    } catch (error) {
      return NextResponse.json({
        error: error?.message || 'AWS S3 is not configured on the server',
      }, { status: 503 })
    }

    await connectDB()

    const body = await request.json().catch(() => ({}))
    const skip = Math.max(0, Number(body?.skip) || 0)
    const limit = Math.min(50, Math.max(1, Number(body?.limit) || 20))
    const includeTotals = body?.includeTotals === true

    const totals = includeTotals
      ? await countProductsNeedingImageMirror(Product, storeId)
      : null

    const batch = await fetchProductsNeedingImageMirrorBatch(Product, storeId, skip, limit)

    let productsUpdated = 0
    let imagesMirrored = 0
    let imagesFailed = 0
    const failures = []

    for (const product of batch) {
      try {
        const mirrored = await mirrorProductRecordImages(product)
        imagesMirrored += mirrored.imagesMirrored
        imagesFailed += mirrored.failures.length

        if (mirrored.failures.length) {
          failures.push(...mirrored.failures.slice(0, 5).map((failure) => ({
            productId: String(product._id),
            productName: product.name,
            ...failure,
          })))
        }

        if (mirrored.changed) {
          await Product.updateOne(
            { _id: product._id, storeId },
            {
              $set: {
                images: mirrored.images,
                externalImages: mirrored.externalImages,
                variants: mirrored.variants,
                imageImportStatus: {
                  ...(product.imageImportStatus || {}),
                  mirroredToS3At: new Date(),
                  mirrored: mirrored.imagesMirrored,
                  failed: mirrored.failures.length,
                },
              },
            },
          )
          productsUpdated += 1
        }
      } catch (error) {
        imagesFailed += 1
        failures.push({
          productId: String(product._id),
          productName: product.name,
          reason: error?.message || 'Failed to migrate product images',
        })
      }
    }

    if (productsUpdated > 0) {
      await invalidateStorefrontProductCaches(storeId)
    }

    const productsPending = totals?.productsPending
    const processedInJob = skip + batch.length
    const hasMore = batch.length === limit

    return NextResponse.json({
      message: hasMore ? 'Image migration batch completed' : 'Image migration completed',
      summary: {
        batchSize: batch.length,
        productsUpdated,
        imagesMirrored,
        imagesFailed,
        hasMore,
        nextSkip: hasMore ? skip + batch.length : null,
      },
      progress: totals
        ? {
          completed: Math.min(processedInJob, totals.productsPending),
          total: totals.productsPending,
          percent: totals.productsPending
            ? Math.min(100, Math.round((processedInJob / totals.productsPending) * 100))
            : 100,
        }
        : null,
      failures: failures.slice(0, 25),
    })
  } catch (error) {
    console.error('[product remirror-images POST] error:', error)
    return NextResponse.json({
      error: error?.message || 'Failed to migrate product images',
    }, { status: 500 })
  }
}
