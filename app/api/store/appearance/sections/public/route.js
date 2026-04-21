import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import StorePreference from '@/models/StorePreference'

const DEFAULT_APPEARANCE = {
  categorySliders: { enabled: true, title: 'Featured Collections', description: 'Browse our curated collections' },
  carouselSlider: { enabled: true, autoPlay: true, interval: 5, showControls: true },
  dealsOfTheDay: { enabled: true, title: 'Deals of the Day', discount: 50 },
  sitemapCategories: { enabled: true, columnsPerRow: 4 },
  homeMenuCategories: { enabled: true, style: 'grid', itemsPerRow: 5, rows: 2 },
  navbarMenu: { enabled: true, position: 'top', style: 'horizontal' },
  exploreYourInterests: { enabled: true, productIds: [] },
  productPageInfo: {
    returnsText: 'FREE Returns',
    vatText: 'All prices include VAT.',
    deliveryPrefix: 'FREE delivery',
    deliverySuffix: 'on your first order.',
    cutoffHour: 23,
    cutoffMinute: 0,
    deliveryMinDays: 2,
    deliveryMaxDays: 5,
    rushPrefix: 'Or ⚡ Rush delivery',
    rushHour: 11,
    rushMinute: 15,
    rushDayLabel: 'Today by'
  },
  pageSeo: {}
}

function normalizePathKey(path = '/') {
  const raw = String(path || '').trim()
  if (!raw) return '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  const withoutQuery = withSlash.split('?')[0].split('#')[0]
  const clean = withoutQuery.replace(/\/{2,}/g, '/').replace(/\/$/, '')
  return clean || '/'
}

function parseKeywords(value) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    )
  }

  return Array.from(
    new Set(
      String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

function normalizePageSeo(pageSeo = {}) {
  if (!pageSeo || typeof pageSeo !== 'object' || Array.isArray(pageSeo)) {
    return DEFAULT_APPEARANCE.pageSeo
  }

  const normalized = {}
  for (const [path, value] of Object.entries(pageSeo)) {
    const key = normalizePathKey(path)
    const entry = value && typeof value === 'object' ? value : {}
    const title = String(entry.title || '').trim().slice(0, 120)
    const description = String(entry.description || '').trim().slice(0, 320)
    const keywords = parseKeywords(entry.keywords).slice(0, 30)

    if (!title && !description && keywords.length === 0) {
      continue
    }

    normalized[key] = { title, description, keywords }
  }

  return normalized
}

function normalizePublic(data = {}) {
  const homeMenuCategories = data.homeMenuCategories || {}
  const exploreYourInterests = data.exploreYourInterests || {}
  const productPageInfo = data.productPageInfo || {}
  const pageSeo = normalizePageSeo(data.pageSeo)
  return {
    homeMenuCategories: {
      enabled: typeof homeMenuCategories.enabled === 'boolean' ? homeMenuCategories.enabled : DEFAULT_APPEARANCE.homeMenuCategories.enabled,
      style: ['grid', 'list', 'carousel', 'horizontal'].includes(homeMenuCategories.style)
        ? homeMenuCategories.style
        : DEFAULT_APPEARANCE.homeMenuCategories.style,
      itemsPerRow: Math.max(1, Math.min(10, Number(homeMenuCategories.itemsPerRow || DEFAULT_APPEARANCE.homeMenuCategories.itemsPerRow))),
      rows: Math.max(1, Math.min(6, Number(homeMenuCategories.rows || DEFAULT_APPEARANCE.homeMenuCategories.rows)))
    },
    exploreYourInterests: {
      enabled:
        typeof exploreYourInterests.enabled === 'boolean'
          ? exploreYourInterests.enabled
          : DEFAULT_APPEARANCE.exploreYourInterests.enabled,
      productIds: Array.isArray(exploreYourInterests.productIds)
        ? Array.from(
            new Set(
              exploreYourInterests.productIds
                .map((id) => String(id || '').trim())
                .filter(Boolean)
            )
          )
        : DEFAULT_APPEARANCE.exploreYourInterests.productIds
    },
    productPageInfo: {
      returnsText: (productPageInfo.returnsText || DEFAULT_APPEARANCE.productPageInfo.returnsText).toString().trim(),
      vatText: (productPageInfo.vatText || DEFAULT_APPEARANCE.productPageInfo.vatText).toString().trim(),
      deliveryPrefix: (productPageInfo.deliveryPrefix || DEFAULT_APPEARANCE.productPageInfo.deliveryPrefix).toString().trim(),
      deliverySuffix: (productPageInfo.deliverySuffix || DEFAULT_APPEARANCE.productPageInfo.deliverySuffix).toString().trim(),
      cutoffHour: Math.max(0, Math.min(23, Number(productPageInfo.cutoffHour ?? DEFAULT_APPEARANCE.productPageInfo.cutoffHour))),
      cutoffMinute: Math.max(0, Math.min(59, Number(productPageInfo.cutoffMinute ?? DEFAULT_APPEARANCE.productPageInfo.cutoffMinute))),
      deliveryMinDays: Math.max(0, Math.min(30, Number(productPageInfo.deliveryMinDays ?? DEFAULT_APPEARANCE.productPageInfo.deliveryMinDays))),
      deliveryMaxDays: Math.max(0, Math.min(45, Number(productPageInfo.deliveryMaxDays ?? DEFAULT_APPEARANCE.productPageInfo.deliveryMaxDays))),
      rushPrefix: (productPageInfo.rushPrefix || DEFAULT_APPEARANCE.productPageInfo.rushPrefix).toString().trim(),
      rushHour: Math.max(0, Math.min(23, Number(productPageInfo.rushHour ?? DEFAULT_APPEARANCE.productPageInfo.rushHour))),
      rushMinute: Math.max(0, Math.min(59, Number(productPageInfo.rushMinute ?? DEFAULT_APPEARANCE.productPageInfo.rushMinute))),
      rushDayLabel: (productPageInfo.rushDayLabel || DEFAULT_APPEARANCE.productPageInfo.rushDayLabel).toString().trim()
    },
    pageSeo
  }
}

export async function GET() {
  try {
    await connectDB()
    const preference = await StorePreference.findOne({}).sort({ updatedAt: -1 }).lean()

    return NextResponse.json(normalizePublic(preference?.appearanceSections || DEFAULT_APPEARANCE), {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    })
  } catch (error) {
    console.error('[appearance sections public GET] error:', error)
    return NextResponse.json(normalizePublic(DEFAULT_APPEARANCE))
  }
}
