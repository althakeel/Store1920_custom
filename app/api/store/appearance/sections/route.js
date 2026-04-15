import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import StorePreference from '@/models/StorePreference'
import authSeller from '@/middlewares/authSeller'

const DEFAULT_APPEARANCE = {
  categorySliders: { enabled: true, title: 'Featured Collections', description: 'Browse our curated collections' },
  carouselSlider: { enabled: true, autoPlay: true, interval: 5, showControls: true },
  dealsOfTheDay: { enabled: true, title: 'Deals of the Day', discount: 50 },
  sitemapCategories: { enabled: true, columnsPerRow: 4 },
  homeMenuCategories: { enabled: true, style: 'grid', itemsPerRow: 5, rows: 2 },
  navbarMenu: { enabled: true, position: 'top', style: 'horizontal' },
  exploreYourInterests: { enabled: true, productIds: [] }
}

async function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const idToken = authHeader.split(' ')[1]
  const { getAuth } = await import('firebase-admin/auth')
  const { initializeApp, getApps } = await import('firebase-admin/app')
  if (getApps().length === 0) initializeApp()

  try {
    const decoded = await getAuth().verifyIdToken(idToken)
    return decoded.uid
  } catch {
    return null
  }
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value)
  if (Number.isNaN(num)) return fallback
  return Math.max(min, Math.min(max, num))
}

function normalizeAppearance(data = {}) {
  const categorySliders = data.categorySliders || {}
  const carouselSlider = data.carouselSlider || {}
  const dealsOfTheDay = data.dealsOfTheDay || {}
  const sitemapCategories = data.sitemapCategories || {}
  const homeMenuCategories = data.homeMenuCategories || {}
  const navbarMenu = data.navbarMenu || {}
  const exploreYourInterests = data.exploreYourInterests || {}

  return {
    categorySliders: {
      enabled: typeof categorySliders.enabled === 'boolean' ? categorySliders.enabled : DEFAULT_APPEARANCE.categorySliders.enabled,
      title: (categorySliders.title || DEFAULT_APPEARANCE.categorySliders.title).toString().trim(),
      description: (categorySliders.description || DEFAULT_APPEARANCE.categorySliders.description).toString().trim()
    },
    carouselSlider: {
      enabled: typeof carouselSlider.enabled === 'boolean' ? carouselSlider.enabled : DEFAULT_APPEARANCE.carouselSlider.enabled,
      autoPlay: typeof carouselSlider.autoPlay === 'boolean' ? carouselSlider.autoPlay : DEFAULT_APPEARANCE.carouselSlider.autoPlay,
      interval: clampNumber(carouselSlider.interval, 1, 30, DEFAULT_APPEARANCE.carouselSlider.interval),
      showControls: typeof carouselSlider.showControls === 'boolean' ? carouselSlider.showControls : DEFAULT_APPEARANCE.carouselSlider.showControls
    },
    dealsOfTheDay: {
      enabled: typeof dealsOfTheDay.enabled === 'boolean' ? dealsOfTheDay.enabled : DEFAULT_APPEARANCE.dealsOfTheDay.enabled,
      title: (dealsOfTheDay.title || DEFAULT_APPEARANCE.dealsOfTheDay.title).toString().trim(),
      discount: clampNumber(dealsOfTheDay.discount, 0, 100, DEFAULT_APPEARANCE.dealsOfTheDay.discount)
    },
    sitemapCategories: {
      enabled: typeof sitemapCategories.enabled === 'boolean' ? sitemapCategories.enabled : DEFAULT_APPEARANCE.sitemapCategories.enabled,
      columnsPerRow: clampNumber(sitemapCategories.columnsPerRow, 1, 8, DEFAULT_APPEARANCE.sitemapCategories.columnsPerRow)
    },
    homeMenuCategories: {
      enabled: typeof homeMenuCategories.enabled === 'boolean' ? homeMenuCategories.enabled : DEFAULT_APPEARANCE.homeMenuCategories.enabled,
      style: ['grid', 'list', 'carousel', 'horizontal'].includes(homeMenuCategories.style)
        ? homeMenuCategories.style
        : DEFAULT_APPEARANCE.homeMenuCategories.style,
      itemsPerRow: clampNumber(homeMenuCategories.itemsPerRow, 1, 10, DEFAULT_APPEARANCE.homeMenuCategories.itemsPerRow),
      rows: clampNumber(homeMenuCategories.rows, 1, 6, DEFAULT_APPEARANCE.homeMenuCategories.rows)
    },
    navbarMenu: {
      enabled: typeof navbarMenu.enabled === 'boolean' ? navbarMenu.enabled : DEFAULT_APPEARANCE.navbarMenu.enabled,
      position: ['top', 'bottom', 'sticky'].includes(navbarMenu.position) ? navbarMenu.position : DEFAULT_APPEARANCE.navbarMenu.position,
      style: ['horizontal', 'vertical', 'minimal'].includes(navbarMenu.style) ? navbarMenu.style : DEFAULT_APPEARANCE.navbarMenu.style
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
    }
  }
}

export async function GET(request) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const storeId = await authSeller(userId)
    if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

    await connectDB()

    let preference = await StorePreference.findOne({ storeId }).lean()
    if (!preference) {
      const created = await StorePreference.create({ storeId })
      preference = created.toObject()
    }

    return NextResponse.json(normalizeAppearance(preference.appearanceSections || DEFAULT_APPEARANCE))
  } catch (error) {
    console.error('[appearance sections GET] error:', error)
    return NextResponse.json(DEFAULT_APPEARANCE)
  }
}

export async function POST(request) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const storeId = await authSeller(userId)
    if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

    const body = await request.json()

    await connectDB()

    const existingPreference = await StorePreference.findOne({ storeId }).lean()
    const mergedPayload = {
      ...(existingPreference?.appearanceSections || {}),
      ...(body || {})
    }
    const appearanceSections = normalizeAppearance(mergedPayload)

    await StorePreference.findOneAndUpdate(
      { storeId },
      { $set: { appearanceSections } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    return NextResponse.json({ message: 'Appearance settings saved', ...appearanceSections })
  } catch (error) {
    console.error('[appearance sections POST] error:', error)
    return NextResponse.json({ error: 'Failed to save appearance settings' }, { status: 500 })
  }
}
