import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import StorePreference from '@/models/StorePreference'
import Store from '@/models/Store'
import Product from '@/models/Product'
import Category from '@/models/Category'
import mongoose from 'mongoose'

const DEFAULT_SHOWCASE = {
  enabled: true,
  featuredSectionTitle: 'Craziest sale of the year!',
  featuredSectionDescription: "Grab the best deals before they're gone!",
  mainBannerEnabled: true,
  mainBannerImage: '',
  mainBannerTitle: 'Power up instantly no battery needed',
  mainBannerSubtitle: 'Never stress over a dead battery again',
  mainBannerCtaText: 'Order Now',
  mainBannerLink: '/shop',
  mainBannerLeftColor: '#00112b',
  mainBannerRightColor: '#00112b',
  mainBannerTitleColor: '#ffffff',
  mainBannerSubtitleColor: '#e5e7eb',
  mainBannerCtaBgColor: '#ef2d2d',
  mainBannerCtaTextColor: '#ffffff',
  sectionTitle: 'More Reasons to Shop',
  leftBlockBadgeText: '',
  leftBlockSource: 'category',
  dealsTitle: 'MEGA DEALS',
  countdownEnd: null,
  categoryIds: [],
  sectionProductIds: [],
  productIds: [],
  topBannerImage: '',
  topBannerTitle: 'SUPER SAVES FOR SUMMER',
  topBannerLink: '/shop',
  bottomBannerImage: '',
  bottomBannerTitle: 'Shop Now. Pay Later. Ready for Summer.',
  bottomBannerCtaText: 'Shop Now',
  bottomBannerLink: '/shop',
  bannerSliderEnabled: true,
  bannerSliderDesktopInterval: 4000,
  bannerSliderMobileInterval: 3000,
  bannerSliderDesktopHeight: 220,
  bannerSliderMobileHeight: 120,
  bannerSliderItems: [
    { id: 'banner-slider-1', image: '', link: '/category/sofas', alt: 'Banner 1' },
    { id: 'banner-slider-2', image: '', link: '/category/beds', alt: 'Banner 2' }
  ],
  secondaryBannerSliderEnabled: true,
  secondaryBannerSliderDesktopInterval: 4000,
  secondaryBannerSliderMobileInterval: 3000,
  secondaryBannerSliderDesktopHeight: 220,
  secondaryBannerSliderMobileHeight: 120,
  secondaryBannerSliderItems: [
    { id: 'secondary-banner-slider-1', image: '', link: '/shop', alt: 'Lower Banner 1' },
    { id: 'secondary-banner-slider-2', image: '', link: '/shop', alt: 'Lower Banner 2' }
  ]
}

function normalizeBannerSliderHeight(value, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(400, Math.max(80, Math.round(numeric)))
}

function normalizeBannerSliderItems(items) {
  if (!Array.isArray(items)) return DEFAULT_SHOWCASE.bannerSliderItems

  const normalized = items
    .slice(0, 6)
    .map((item, index) => ({
      id: (item?.id || `banner-slider-${index + 1}`).toString().trim(),
      image: (item?.image || '').toString().trim(),
      link: (item?.link || '/shop').toString().trim(),
      alt: (item?.alt || `Banner ${index + 1}`).toString().trim()
    }))

  return normalized.length ? normalized : DEFAULT_SHOWCASE.bannerSliderItems
}

function normalizeSecondaryBannerSliderItems(items) {
  if (!Array.isArray(items)) return DEFAULT_SHOWCASE.secondaryBannerSliderItems

  const normalized = items
    .slice(0, 6)
    .map((item, index) => ({
      id: (item?.id || `secondary-banner-slider-${index + 1}`).toString().trim(),
      image: (item?.image || '').toString().trim(),
      link: (item?.link || '/shop').toString().trim(),
      alt: (item?.alt || `Lower Banner ${index + 1}`).toString().trim()
    }))

  return normalized.length ? normalized : DEFAULT_SHOWCASE.secondaryBannerSliderItems
}

function normalize(data = {}) {
  return {
    ...DEFAULT_SHOWCASE,
    ...data,
    leftBlockBadgeText: typeof data.leftBlockBadgeText === 'string' ? data.leftBlockBadgeText.trim().slice(0, 12) : DEFAULT_SHOWCASE.leftBlockBadgeText,
    leftBlockSource: data.leftBlockSource === 'product' ? 'product' : 'category',
    categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds.slice(0, 4).map(String) : [],
    sectionProductIds: Array.isArray(data.sectionProductIds) ? data.sectionProductIds.slice(0, 4).map(String) : [],
    productIds: Array.isArray(data.productIds) ? data.productIds.slice(0, 20).map(String) : [],
    bannerSliderEnabled: typeof data.bannerSliderEnabled === 'boolean' ? data.bannerSliderEnabled : DEFAULT_SHOWCASE.bannerSliderEnabled,
    bannerSliderDesktopInterval: Math.max(1500, Number(data.bannerSliderDesktopInterval) || DEFAULT_SHOWCASE.bannerSliderDesktopInterval),
    bannerSliderMobileInterval: Math.max(1500, Number(data.bannerSliderMobileInterval) || DEFAULT_SHOWCASE.bannerSliderMobileInterval),
    bannerSliderDesktopHeight: normalizeBannerSliderHeight(data.bannerSliderDesktopHeight, DEFAULT_SHOWCASE.bannerSliderDesktopHeight),
    bannerSliderMobileHeight: normalizeBannerSliderHeight(data.bannerSliderMobileHeight, DEFAULT_SHOWCASE.bannerSliderMobileHeight),
    bannerSliderItems: normalizeBannerSliderItems(data.bannerSliderItems),
    secondaryBannerSliderEnabled: typeof data.secondaryBannerSliderEnabled === 'boolean' ? data.secondaryBannerSliderEnabled : DEFAULT_SHOWCASE.secondaryBannerSliderEnabled,
    secondaryBannerSliderDesktopInterval: Math.max(1500, Number(data.secondaryBannerSliderDesktopInterval) || DEFAULT_SHOWCASE.secondaryBannerSliderDesktopInterval),
    secondaryBannerSliderMobileInterval: Math.max(1500, Number(data.secondaryBannerSliderMobileInterval) || DEFAULT_SHOWCASE.secondaryBannerSliderMobileInterval),
    secondaryBannerSliderDesktopHeight: normalizeBannerSliderHeight(data.secondaryBannerSliderDesktopHeight, DEFAULT_SHOWCASE.secondaryBannerSliderDesktopHeight),
    secondaryBannerSliderMobileHeight: normalizeBannerSliderHeight(data.secondaryBannerSliderMobileHeight, DEFAULT_SHOWCASE.secondaryBannerSliderMobileHeight),
    secondaryBannerSliderItems: normalizeSecondaryBannerSliderItems(data.secondaryBannerSliderItems)
  }
}

function orderByIds(items, ids) {
  const orderMap = new Map(ids.map((id, index) => [String(id), index]))
  return [...items].sort((first, second) => {
    const firstOrder = orderMap.get(String(first._id))
    const secondOrder = orderMap.get(String(second._id))
    return (firstOrder ?? Number.MAX_SAFE_INTEGER) - (secondOrder ?? Number.MAX_SAFE_INTEGER)
  })
}

export async function GET() {
  try {
    await connectDB()

    // Keep the same public store source used by /api/store/featured-products (first store).
    const store = await Store.findOne().select('_id').lean()

    const preference = store?._id
      ? await StorePreference.findOne({ storeId: store._id }).lean()
      : await StorePreference.findOne().sort({ updatedAt: -1 }).lean()

    const config = normalize(preference?.shopShowcase || DEFAULT_SHOWCASE)

    const validSectionProductIds = (config.sectionProductIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id))
    const validProductIds = (config.productIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id))
    const validCategoryIds = (config.categoryIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id))

    const [sectionProducts, products, categories] = await Promise.all([
      validSectionProductIds.length
        ? Product.find({ _id: { $in: validSectionProductIds } })
            .select('_id name slug images price AED')
            .lean()
        : Promise.resolve([]),
      validProductIds.length
        ? Product.find({ _id: { $in: validProductIds } })
            .select('_id name slug images price AED')
            .lean()
        : Promise.resolve([]),
      validCategoryIds.length
        ? Category.find({ _id: { $in: validCategoryIds } })
            .select('_id name slug image')
            .lean()
        : Promise.resolve([])
    ])

    return NextResponse.json({
      config,
      sectionProducts: orderByIds(sectionProducts, validSectionProductIds),
      products: orderByIds(products, validProductIds),
      categories: orderByIds(categories, validCategoryIds)
    })
  } catch (error) {
    console.error('[public shop-showcase GET] error:', error)
    return NextResponse.json({ config: DEFAULT_SHOWCASE, sectionProducts: [], products: [], categories: [] })
  }
}
