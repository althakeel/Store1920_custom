import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import StorePreference from '@/models/StorePreference'

const DEFAULT_APPEARANCE = {
  categorySliders: { enabled: true, title: 'Featured Collections', description: 'Browse our curated collections' },
  carouselSlider: { enabled: true, autoPlay: true, interval: 5, showControls: true },
  dealsOfTheDay: { enabled: true, title: 'Deals of the Day', discount: 50 },
  sitemapCategories: { enabled: true, columnsPerRow: 4 },
  homeMenuCategories: { enabled: true, style: 'grid', itemsPerRow: 5, rows: 2 },
  navbarMenu: { enabled: true, position: 'top', style: 'horizontal' }
}

function normalizePublic(data = {}) {
  const homeMenuCategories = data.homeMenuCategories || {}
  return {
    homeMenuCategories: {
      enabled: typeof homeMenuCategories.enabled === 'boolean' ? homeMenuCategories.enabled : DEFAULT_APPEARANCE.homeMenuCategories.enabled,
      style: ['grid', 'list', 'carousel', 'horizontal'].includes(homeMenuCategories.style)
        ? homeMenuCategories.style
        : DEFAULT_APPEARANCE.homeMenuCategories.style,
      itemsPerRow: Math.max(1, Math.min(10, Number(homeMenuCategories.itemsPerRow || DEFAULT_APPEARANCE.homeMenuCategories.itemsPerRow))),
      rows: Math.max(1, Math.min(6, Number(homeMenuCategories.rows || DEFAULT_APPEARANCE.homeMenuCategories.rows)))
    }
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
