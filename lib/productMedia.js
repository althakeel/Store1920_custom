import { PLACEHOLDER_IMAGE as PLACEHOLDER } from '@/lib/mediaUrls'

export const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.avi', '.mkv']
export const DEFAULT_CARD_VIDEO_DELAY_SEC = 24

export function isVideoSource(value = '') {
  const raw = String(value || '').trim().toLowerCase().split('?')[0]
  if (!raw) return false
  return VIDEO_EXTENSIONS.some((ext) => raw.endsWith(ext))
}

export function normalizeProductImages(images) {
  if (Array.isArray(images)) {
    return images.filter((img) => {
      if (typeof img === 'string') return img.trim().length > 0
      if (typeof img === 'object' && img !== null) {
        return img.url || img.src || img.path || img.data || false
      }
      return false
    })
  }

  if (images === null || images === undefined) return []

  if (typeof images === 'object') {
    if (images.url || images.src || images.path || images.data) return [images]
    return []
  }

  if (typeof images === 'string') {
    return images.trim().length > 0 ? [images] : []
  }

  return []
}

export function getImageUrlAt(images, index = 0, fallbackImage = '') {
  const imagesArray = normalizeProductImages(images)
  if (imagesArray.length > index) {
    const current = imagesArray[index]
    if (typeof current === 'object' && current?.url) return current.url
    if (typeof current === 'object' && current?.src) return current.src
    if (typeof current === 'string' && current.trim() !== '') return current
  }

  if (index === 0 && fallbackImage) return fallbackImage
  return PLACEHOLDER
}

export function getCardVideoDelayMs(product) {
  const raw = Number(product?.cardVideoPreviewDelaySec)
  if (Number.isFinite(raw) && raw >= 0) return raw * 1000
  return DEFAULT_CARD_VIDEO_DELAY_SEC * 1000
}

/**
 * Resolves how a product card should render its hero media.
 * - image: show first image (with optional hover secondary)
 * - video: first media is video, play immediately
 * - delayed-video: show poster image first, then video after load + delay
 */
export function resolveCardVideoPreview(product) {
  const images = normalizeProductImages(product?.images)
  const delayMs = getCardVideoDelayMs(product)
  const enabled = product?.cardVideoPreviewEnabled !== false

  if (!images.length && !product?.image) {
    return { type: 'image', imageSrc: PLACEHOLDER, videoSrc: null, delayMs }
  }

  const firstUrl = getImageUrlAt(images, 0, product?.image)
  const firstIsVideo = isVideoSource(firstUrl)

  if (!firstIsVideo) {
    return { type: 'image', imageSrc: firstUrl || PLACEHOLDER, videoSrc: null, delayMs }
  }

  let posterUrl = null
  for (let index = 1; index < images.length; index += 1) {
    const url = getImageUrlAt(images, index)
    if (url && url !== PLACEHOLDER && !isVideoSource(url)) {
      posterUrl = url
      break
    }
  }

  if (!enabled || !posterUrl) {
    return { type: 'video', imageSrc: posterUrl || PLACEHOLDER, videoSrc: firstUrl, delayMs }
  }

  return {
    type: 'delayed-video',
    imageSrc: posterUrl,
    videoSrc: firstUrl,
    delayMs,
  }
}

/**
 * Best image URL for lists, admin tables, cart thumbs, search, etc.
 * If media #1 is a video, returns the first non-video image (usually #2).
 */
export function getProductThumbnailUrl(productOrImages, options = {}) {
  const { fallback = PLACEHOLDER, allowVideo = false } = options
  const isProductObject = Boolean(
    productOrImages
    && !Array.isArray(productOrImages)
    && typeof productOrImages === 'object'
    && ('images' in productOrImages || 'image' in productOrImages)
  )

  const images = isProductObject ? productOrImages.images : productOrImages
  const productFallback = isProductObject ? productOrImages.image : ''
  const normalized = normalizeProductImages(images)

  if (!normalized.length) {
    const emptyFallback = productFallback || fallback
    if (!emptyFallback || emptyFallback === PLACEHOLDER) return fallback
    return allowVideo || !isVideoSource(emptyFallback) ? emptyFallback : fallback
  }

  const firstUrl = getImageUrlAt(normalized, 0, productFallback)
  if (!isVideoSource(firstUrl)) {
    return firstUrl !== PLACEHOLDER ? firstUrl : (productFallback || fallback)
  }

  for (let index = 1; index < normalized.length; index += 1) {
    const url = getImageUrlAt(normalized, index)
    if (url && url !== PLACEHOLDER && !isVideoSource(url)) {
      return url
    }
  }

  return allowVideo ? firstUrl : (productFallback || fallback)
}

export function buildProductMediaGallery(images) {
  const normalized = normalizeProductImages(images)
  const items = normalized
    .map((entry) => {
      const src = getImageUrlAt([entry], 0)
      if (!src || src === PLACEHOLDER) return null
      return {
        src,
        type: isVideoSource(src) ? 'video' : 'image',
      }
    })
    .filter(Boolean)

  const imageSources = items.filter((item) => item.type === 'image').map((item) => item.src)

  return items.map((item, index) => {
    if (item.type !== 'video') {
      return { ...item, poster: item.src }
    }

    let poster = null
    for (let next = index + 1; next < items.length; next += 1) {
      if (items[next].type === 'image') {
        poster = items[next].src
        break
      }
    }
    if (!poster) {
      for (let prev = index - 1; prev >= 0; prev -= 1) {
        if (items[prev].type === 'image') {
          poster = items[prev].src
          break
        }
      }
    }
    if (!poster) {
      poster = imageSources[0] || PLACEHOLDER
    }

    return { ...item, poster }
  })
}

export function findMediaIndexBySrc(gallery = [], value = '') {
  const target = String(value || '').trim()
  if (!target) return -1
  return gallery.findIndex((item) => item.src === target || item.poster === target)
}

export function getProductImageAspectRatioClass(ratio = '1:1') {
  switch (String(ratio || '1:1')) {
    case '4:5':
      return 'aspect-[4/5]'
    case '3:4':
      return 'aspect-[3/4]'
    case '16:9':
      return 'aspect-video'
    case '1:1':
    default:
      return 'aspect-square'
  }
}
