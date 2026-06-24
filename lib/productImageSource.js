export const MIN_PRODUCT_IMAGE_WIDTH = 400

export const MIRROR_IMAGE_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Request original formats first so WordPress/CDN does not return a smaller WebP/AVIF derivative.
  Accept: 'image/jpeg, image/png, image/gif, image/apng, image/tiff, image/*;q=0.9, */*;q=0.5',
}

const IMAGE_EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/apng': 'png',
  'image/tiff': 'tiff',
}

export function stripImageResizeQueryParams(url = '') {
  const value = String(url || '').trim()
  if (!value) return value

  try {
    const parsed = new URL(value)
    const resizeKeys = [
      'w', 'width', 'h', 'height', 'resize', 'fit', 'quality', 'q',
      'format', 'fm', 'auto', 'dpr', 'crop', 'sharp', 'blur',
    ]
    resizeKeys.forEach((key) => parsed.searchParams.delete(key))
    if ([...parsed.searchParams.keys()].length === 0) {
      parsed.search = ''
    }
    return parsed.toString()
  } catch {
    return value
  }
}

export function buildMirrorImageUrlCandidates(imageUrl = '') {
  const original = String(imageUrl || '').trim()
  const candidates = []
  const add = (url) => {
    const value = String(url || '').trim()
    if (value && !candidates.includes(value)) {
      candidates.push(value)
    }
  }

  const normalized = normalizeRemoteProductImageUrl(original)
  add(stripImageResizeQueryParams(normalized))
  add(normalized)
  add(stripImageResizeQueryParams(original))
  add(original)

  return candidates
}

export function guessImageExtensionFromSource(sourceUrl = '', contentType = '') {
  try {
    const pathname = new URL(sourceUrl).pathname || ''
    const ext = pathname.split('.').pop()?.toLowerCase()
    if (ext && Object.values(IMAGE_EXTENSION_BY_MIME).includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext
    }
  } catch {
    // ignore
  }

  const normalizedType = String(contentType || '').split(';')[0].trim().toLowerCase()
  return IMAGE_EXTENSION_BY_MIME[normalizedType] || 'jpg'
}

export async function downloadRemoteImageForMirror(imageUrl, { minWidth = 0, timeoutMs = 30000 } = {}) {
  const candidates = buildMirrorImageUrlCandidates(imageUrl)
  let best = null

  for (const candidate of candidates) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(candidate, {
        headers: MIRROR_IMAGE_FETCH_HEADERS,
        redirect: 'follow',
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!response.ok) continue

      const buffer = Buffer.from(await response.arrayBuffer())
      if (!buffer.length) continue

      const contentType = response.headers.get('content-type') || ''
      const dimensions = readImageDimensions(buffer)
      const result = {
        buffer,
        contentType,
        sourceUrl: candidate,
        dimensions,
        extension: guessImageExtensionFromSource(candidate, contentType),
      }

      if (minWidth > 0 && dimensions?.width >= minWidth && dimensions?.height >= minWidth) {
        return result
      }

      const currentWidth = dimensions?.width || 0
      const bestWidth = best?.dimensions?.width || 0
      const currentBytes = buffer.length
      const bestBytes = best?.buffer?.length || 0

      if (!best || currentWidth > bestWidth || (currentWidth === bestWidth && currentBytes > bestBytes)) {
        best = result
      }
    } catch {
      // Try the next candidate URL.
    }
  }

  if (!best) {
    throw new Error('Failed to download image')
  }

  if (minWidth > 0 && isLowResolutionImageBuffer(best.buffer, minWidth)) {
    throw new Error(`Image is too small (under ${minWidth}px). Use the full-size image URL.`)
  }

  return best
}

export function normalizeRemoteProductImageUrl(url = '') {
  const value = String(url || '').trim()
  if (!value) return value

  try {
    const parsed = new URL(value)

    // ImageKit / CDN transforms — keep path only (full original when possible).
    if (parsed.hostname.includes('imagekit.io')) {
      const path = parsed.pathname || ''
      const uploadsIndex = path.indexOf('/uploads/')
      if (uploadsIndex >= 0) {
        parsed.pathname = path.slice(uploadsIndex)
        parsed.search = ''
      }
    }

    // WordPress/WooCommerce sized derivatives: image-300x300.jpg → image.jpg
    parsed.pathname = parsed.pathname
      .replace(/-\d+x\d+(?=\.[^./]+$)/i, '')
      .replace(/-scaled(?=\.[^./]+$)/i, '')

    return parsed.toString()
  } catch {
    return value
      .replace(/-\d+x\d+(?=\.[^./]+$)/i, '')
      .replace(/-scaled(?=\.[^./]+$)/i, '')
  }
}

export function readImageDimensions(buffer) {
  if (!buffer || buffer.length < 24) return null

  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }

  // WebP (VP8X / VP8 / VP8L)
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('ascii', 12, 16)
    if (chunk === 'VP8X' && buffer.length >= 30) {
      return {
        width: 1 + buffer.readUIntLE(24) + (buffer[25] << 8) + (buffer[26] << 16),
        height: 1 + buffer.readUIntLE(27) + (buffer[28] << 8) + (buffer[29] << 16),
      }
    }
    if (chunk === 'VP8 ' && buffer.length >= 30) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      }
    }
  }

  // JPEG — scan for SOF marker
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) break
      const marker = buffer[offset + 1]
      const length = buffer.readUInt16BE(offset + 2)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        }
      }
      offset += 2 + length
    }
  }

  return null
}

export function isLowResolutionImageBuffer(buffer, minWidth = MIN_PRODUCT_IMAGE_WIDTH) {
  const dimensions = readImageDimensions(buffer)
  if (!dimensions?.width) return false
  return dimensions.width < minWidth || dimensions.height < minWidth
}
