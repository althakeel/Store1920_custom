import { isHostedMediaUrl, mirrorRemoteImageToS3 } from '@/lib/storage'
import {
  MIN_PRODUCT_IMAGE_WIDTH,
  normalizeRemoteProductImageUrl,
} from '@/lib/productImageSource'

function sanitizeFilePart(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'product'
}

export function shouldMirrorProductImageUrl(url = '') {
  const value = String(url || '').trim()
  if (!value) return false
  if (value.startsWith('/') && !value.startsWith('//')) return false
  if (!/^https?:\/\//i.test(value)) return false
  if (isHostedMediaUrl(value)) return false
  return true
}

export function collectProductImageUrls(product = {}) {
  const urls = []

  for (const image of product.images || []) {
    if (image) urls.push(String(image))
  }

  for (const variant of product.variants || []) {
    const variantImage = variant?.options?.image
    if (variantImage) urls.push(String(variantImage))
  }

  return urls
}

export function resolveProductImageMirrorSource(currentUrl = '', savedExternalUrl = '') {
  const current = String(currentUrl || '').trim()
  const savedExternal = String(savedExternalUrl || '').trim()

  if (shouldMirrorProductImageUrl(current)) {
    return normalizeRemoteProductImageUrl(current)
  }

  if (isHostedMediaUrl(current) && shouldMirrorProductImageUrl(savedExternal)) {
    return normalizeRemoteProductImageUrl(savedExternal)
  }

  return ''
}

export function productHasExternalImages(product = {}) {
  const images = product.images || []
  const externalImages = product.externalImages || []

  for (let index = 0; index < images.length; index += 1) {
    if (resolveProductImageMirrorSource(images[index], externalImages[index])) {
      return true
    }
  }

  for (const variant of product.variants || []) {
    const variantImage = variant?.options?.image
    if (resolveProductImageMirrorSource(variantImage)) return true
  }

  return (externalImages || []).some((url) => shouldMirrorProductImageUrl(url))
}

export async function mirrorImageUrlToS3(imageUrl, { storeId, slug, imageIndex = 0 }) {
  const normalizedUrl = normalizeRemoteProductImageUrl(imageUrl)
  if (!shouldMirrorProductImageUrl(normalizedUrl)) {
    return {
      originalUrl: imageUrl,
      finalUrl: imageUrl,
      mirrored: false,
    }
  }

  const fileName = `${sanitizeFilePart(slug)}-${imageIndex + 1}-${Date.now()}`
  const upload = await mirrorRemoteImageToS3(normalizedUrl, {
    folder: `products/imported/${sanitizeFilePart(storeId || 'store')}`,
    fileName,
    minWidth: MIN_PRODUCT_IMAGE_WIDTH,
  })

  return {
    originalUrl: normalizedUrl,
    finalUrl: upload.url,
    mirrored: true,
  }
}

async function mirrorUrlList(urls = [], savedExternalUrls = [], { storeId, slug }) {
  const finalUrls = []
  const externalUrls = []
  let mirroredCount = 0
  const failures = []

  for (let index = 0; index < urls.length; index += 1) {
    const currentUrl = String(urls[index] || '').trim()
    if (!currentUrl) continue

    const sourceUrl = resolveProductImageMirrorSource(
      currentUrl,
      savedExternalUrls[index] || savedExternalUrls.find((url) => shouldMirrorProductImageUrl(url)),
    )

    if (!sourceUrl) {
      finalUrls.push(currentUrl)
      continue
    }

    try {
      const result = await mirrorImageUrlToS3(sourceUrl, { storeId, slug, imageIndex: index })
      finalUrls.push(result.finalUrl)
      if (result.mirrored) {
        mirroredCount += 1
        externalUrls.push(result.originalUrl)
      } else {
        externalUrls.push(sourceUrl)
      }
    } catch (error) {
      failures.push({
        url: sourceUrl,
        reason: error?.message || 'Failed to mirror image',
      })
      finalUrls.push(currentUrl)
      externalUrls.push(sourceUrl)
    }
  }

  return { finalUrls, externalUrls, mirroredCount, failures }
}

export async function mirrorProductRecordImages(product = {}) {
  const storeId = product.storeId
  const slug = product.slug || product._id || product.name || 'product'

  const imageResult = await mirrorUrlList(product.images || [], product.externalImages || [], { storeId, slug })
  const variants = Array.isArray(product.variants) ? product.variants.map((variant) => ({ ...variant })) : []
  let variantMirrored = 0
  const variantFailures = []

  for (let index = 0; index < variants.length; index += 1) {
    const variantImage = variants[index]?.options?.image
    if (!variantImage) continue

    try {
      const result = await mirrorImageUrlToS3(variantImage, {
        storeId,
        slug: `${slug}-var-${index + 1}`,
        imageIndex: index,
      })
      if (result.mirrored) {
        variantMirrored += 1
        variants[index].options = {
          ...(variants[index].options || {}),
          image: result.finalUrl,
        }
      }
    } catch (error) {
      variantFailures.push({
        url: variantImage,
        reason: error?.message || 'Failed to mirror variant image',
      })
    }
  }

  const mergedExternal = [
    ...new Set([
      ...(product.externalImages || []),
      ...imageResult.externalUrls,
    ]),
  ].filter(Boolean)

  return {
    images: imageResult.finalUrls.length ? imageResult.finalUrls : product.images || [],
    externalImages: mergedExternal,
    variants,
    imagesMirrored: imageResult.mirroredCount + variantMirrored,
    failures: [...imageResult.failures, ...variantFailures],
    changed: imageResult.mirroredCount + variantMirrored > 0
      || imageResult.finalUrls.join('|') !== (product.images || []).join('|'),
  }
}

export async function countProductsNeedingImageMirror(Product, storeId) {
  let productsPending = 0
  let externalImages = 0

  const cursor = Product.find({ storeId }).select('images externalImages variants').lean().cursor()
  for await (const product of cursor) {
    if (!productHasExternalImages(product)) continue
    productsPending += 1
    const images = product.images || []
    const savedExternal = product.externalImages || []
    for (let index = 0; index < images.length; index += 1) {
      if (resolveProductImageMirrorSource(images[index], savedExternal[index])) {
        externalImages += 1
      }
    }
  }

  return { productsPending, externalImages }
}

export async function fetchProductsNeedingImageMirrorBatch(Product, storeId, skip = 0, limit = 20) {
  const batch = []
  let skipped = 0

  const cursor = Product.find({ storeId })
    .select('_id storeId slug name images externalImages variants imageImportStatus')
    .lean()
    .cursor()

  for await (const product of cursor) {
    if (!productHasExternalImages(product)) continue
    if (skipped < skip) {
      skipped += 1
      continue
    }
    batch.push(product)
    if (batch.length >= limit) break
  }

  return batch
}
