'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './ShopShowcaseSection.module.css'
import { resolveStoreNavMenuItems } from '@/lib/categoryNavigation'
import axios from 'axios'
import Link from 'next/link'
import bannerStyles from './ShopShowcaseSectionBanners.module.css'
import productGridStyles from './ShopShowcaseSectionProducts.module.css'
import ShowcaseProductBanners from './ShowcaseProductBanners'
import { HOME_SECTION_CLASS } from '@/lib/storefrontCarousel'
import { cleanDisplayText } from '@/lib/displayText'
import { getProductPath } from '@/lib/productUrl'
import {
  Baby,
  Bike,
  Car,
  ChevronRight,
  Headphones,
  Info,
  Laptop,
  Search,
  Smartphone,
  Truck,
  ToyBrick,
  Tv,
  Watch,
} from 'lucide-react'
import { useStorefrontMarket } from '@/lib/useStorefrontMarket'
import { getProductThumbnailUrl } from '@/lib/productMedia'

const NAVBAR_APPEARANCE_CACHE_KEY = 'navbarAppearanceCache'
const DEFAULT_NAVBAR_BG = '#8f3404'

function readCachedNavbarBg() {
  if (typeof window === 'undefined') return DEFAULT_NAVBAR_BG

  try {
    const raw = window.localStorage.getItem(NAVBAR_APPEARANCE_CACHE_KEY)
    if (!raw) return DEFAULT_NAVBAR_BG

    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.backgroundColor === 'string' && parsed.backgroundColor.trim()) {
      return parsed.backgroundColor.trim()
    }
  } catch {
    // Ignore cache read failures.
  }

  return DEFAULT_NAVBAR_BG
}

function useNavbarBackgroundColor() {
  const [navbarBg, setNavbarBg] = useState(DEFAULT_NAVBAR_BG)

  useEffect(() => {
    setNavbarBg(readCachedNavbarBg())

    const controller = new AbortController()

    fetch(`/api/store/navbar-menu?t=${Date.now()}`, { cache: 'no-store', signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const nextBg = String(data?.backgroundColor || '').trim()
        if (nextBg) setNavbarBg(nextBg)
      })
      .catch(() => {})

    const handleNavbarAppearanceUpdate = (event) => {
      const nextBg = event?.detail?.backgroundColor
      if (typeof nextBg === 'string' && nextBg.trim()) {
        setNavbarBg(nextBg.trim())
        return
      }
      setNavbarBg(readCachedNavbarBg())
    }

    window.addEventListener('navbarAppearanceUpdated', handleNavbarAppearanceUpdate)
    return () => {
      controller.abort()
      window.removeEventListener('navbarAppearanceUpdated', handleNavbarAppearanceUpdate)
    }
  }, [])

  return navbarBg
}

function getCategoryHref(category) {
  if (category?.slug) return `/shop?category=${encodeURIComponent(category.slug)}`
  if (category?._id) return `/shop?category=${encodeURIComponent(String(category._id))}`
  return '/shop'
}

function getProductHref(product) {
  return getProductPath(product)
}

function getProductImage(product) {
  return getProductThumbnailUrl(product, { fallback: '' })
}

function isIconImageUrl(value) {
  const icon = String(value || '').trim()
  if (!icon) return false
  return icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/') || icon.startsWith('data:image/')
}

function getOriginalImageUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.replace(/\/tr:[^/]+\//i, '/')
}

function ShopShowcaseSkeleton({ navbarBg = DEFAULT_NAVBAR_BG }) {
  return (
    <section className={`${HOME_SECTION_CLASS} max-w-[1400px] mx-auto px-0 sm:px-6`} aria-label="Loading shop showcase">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-stretch">
        <div className="relative hidden min-h-0 lg:block">
          <aside className="absolute inset-0 flex min-h-0 flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: navbarBg }}>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-[2px] bg-white/25" />
                <div className="h-3 w-24 rounded-[2px] bg-white/35" />
              </div>
              <div className="h-3 w-3 rounded-[2px] bg-white/25" />
            </div>
            <div className={`${styles.leftMenuScroll} animate-pulse`}>
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                  <div className="h-4 w-4 rounded-[2px] bg-slate-200" />
                  <div className="h-3 flex-1 rounded-[2px] bg-slate-200" />
                  <div className="h-3 w-3 rounded-[2px] bg-slate-200" />
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className={bannerStyles.bannerGrid}>
          <div className={`${bannerStyles.bannerRow} relative overflow-hidden rounded-[2px] border border-slate-200 bg-slate-100 shadow-sm`}>
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
            <div className="absolute inset-0 flex items-center px-8">
              <div className="space-y-3">
                <div className="h-8 w-48 rounded-[2px] bg-white/60" />
                <div className="h-4 w-32 rounded-[2px] bg-white/60" />
                <div className="h-8 w-28 rounded-[2px] bg-white/60" />
              </div>
            </div>
          </div>

          <div className={`${bannerStyles.bannerRow} relative overflow-hidden rounded-[2px] border border-slate-200 bg-slate-100 shadow-sm`}>
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-5 w-56 rounded-[2px] bg-white/65" />
            </div>
          </div>
        </div>

        <div className="hidden lg:col-span-2 lg:grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="aspect-[1225/639] animate-pulse rounded-[2px] border border-slate-200 bg-slate-100" />
          ))}
        </div>
      </div>
    </section>
  )
}

function getCategoryIconByName(name) {
  const text = String(name || '').toLowerCase()
  if (text.includes('mobile') || text.includes('phone')) return Smartphone
  if (text.includes('electronic') || text.includes('appliance') || text.includes('tv')) return Tv
  if (text.includes('computer') || text.includes('laptop')) return Laptop
  if (text.includes('headphone') || text.includes('audio')) return Headphones
  if (text.includes('watch')) return Watch
  if (text.includes('sport')) return Bike
  if (text.includes('baby')) return Baby
  if (text.includes('car') || text.includes('auto')) return Car
  if (text.includes('toy')) return ToyBrick
  return Info
}

export default function ShopShowcaseSection({
  initialShowcaseData = null,
  initialStoreSettings = null,
  skipInitialFetch = false,
}) {
  const hasInitialData = Boolean(initialShowcaseData);
  const [loading, setLoading] = useState(!hasInitialData && !skipInitialFetch);
  const [data, setData] = useState(initialShowcaseData || { config: null, sectionProducts: [], products: [], categories: [] });
  const [storeMenuItems, setStoreMenuItems] = useState(
    Array.isArray(initialStoreSettings?.navMenuItems) ? initialStoreSettings.navMenuItems : []
  );
  const [navMenuUseParentCategories, setNavMenuUseParentCategories] = useState(
    Boolean(initialStoreSettings?.navMenuUseParentCategories),
  );
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [menuStyle, setMenuStyle] = useState({
    showcaseFlyoutBackgroundColor: '#ffffff',
    showcaseFlyoutTitleColor: '#0f172a',
    showcaseFlyoutLinkColor: '#1f2937',
    showcaseFlyoutHoverColor: '#f8fafc',
    showcaseFlyoutBorderColor: '#dbe3ee',
  })
  const [hoveredMenuIndex, setHoveredMenuIndex] = useState(null)
  const [flyoutPosition, setFlyoutPosition] = useState({ top: 0, maxHeight: 360 })
  const closeFlyoutTimerRef = useRef(null)
  const menuContainerRef = useRef(null)
  const menuScrollRef = useRef(null)
  const menuItemRefs = useRef([])
  const { market, convertPrice } = useStorefrontMarket()
  const navbarBg = useNavbarBackgroundColor()

  const clearFlyoutCloseTimer = () => {
    if (closeFlyoutTimerRef.current) {
      window.clearTimeout(closeFlyoutTimerRef.current)
      closeFlyoutTimerRef.current = null
    }
  }

  const scheduleFlyoutClose = () => {
    clearFlyoutCloseTimer()
    closeFlyoutTimerRef.current = window.setTimeout(() => {
      setHoveredMenuIndex(null)
    }, 320)
  }

  const updateFlyoutPosition = (index) => {
    const row = menuItemRefs.current[index]
    const container = menuContainerRef.current
    if (!row || !container) {
      setFlyoutPosition({ top: 0, maxHeight: 360 })
      return
    }

    const containerRect = container.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    const containerHeight = container.offsetHeight || containerRect.height
    const preferredHeight = 360
    const minVisibleHeight = 220

    let top = Math.max(0, rowRect.top - containerRect.top)
    let maxHeight = Math.min(preferredHeight, containerHeight - top)

    if (maxHeight < minVisibleHeight) {
      top = Math.max(0, containerHeight - preferredHeight)
      maxHeight = Math.min(preferredHeight, containerHeight - top)
    }

    setFlyoutPosition({ top, maxHeight })
  }

  const handleMenuItemHover = (index) => {
    clearFlyoutCloseTimer()
    setHoveredMenuIndex(index)
    window.requestAnimationFrame(() => updateFlyoutPosition(index))
  }

  useEffect(() => {
    if (skipInitialFetch && initialShowcaseData) {
      const advancedItems = resolveStoreNavMenuItems(
        {
          navMenuUseParentCategories: Boolean(initialStoreSettings?.navMenuUseParentCategories),
          navMenuItems: initialStoreSettings?.navMenuItems,
        },
        Array.isArray(initialShowcaseData?.categories) ? initialShowcaseData.categories : [],
      );
      if (advancedItems.length) {
        setStoreMenuItems(advancedItems);
      }
      setNavMenuUseParentCategories(Boolean(initialStoreSettings?.navMenuUseParentCategories));
      if (Array.isArray(initialShowcaseData?.categories)) {
        setCatalogCategories(initialShowcaseData.categories);
      }
      const resolvedMenuStyle = initialStoreSettings?.navMenuStyle && typeof initialStoreSettings.navMenuStyle === 'object'
        ? initialStoreSettings.navMenuStyle
        : {};
      setMenuStyle((prev) => ({
        ...prev,
        showcaseFlyoutBackgroundColor: String(resolvedMenuStyle.showcaseFlyoutBackgroundColor || prev.showcaseFlyoutBackgroundColor),
        showcaseFlyoutTitleColor: String(resolvedMenuStyle.showcaseFlyoutTitleColor || prev.showcaseFlyoutTitleColor),
        showcaseFlyoutLinkColor: String(resolvedMenuStyle.showcaseFlyoutLinkColor || prev.showcaseFlyoutLinkColor),
        showcaseFlyoutHoverColor: String(resolvedMenuStyle.showcaseFlyoutHoverColor || prev.showcaseFlyoutHoverColor),
        showcaseFlyoutBorderColor: String(resolvedMenuStyle.showcaseFlyoutBorderColor || prev.showcaseFlyoutBorderColor),
      }));
      setLoading(false);
    }

    const load = async () => {
      try {
        const [showcaseRes, settingsRes, navbarRes, categoriesRes] = await Promise.all([
          initialShowcaseData
            ? Promise.resolve({ data: initialShowcaseData })
            : axios.get('/api/public/shop-showcase'),
          axios.get('/api/store/settings').catch(() => ({ data: {} })),
          axios.get('/api/store/navbar-menu').catch(() => ({ data: {} })),
          axios.get('/api/categories').catch(() => ({ data: { categories: [] } })),
        ])

        const showcaseData = showcaseRes.data || { config: null, sectionProducts: [], products: [], categories: [] }
        setData(showcaseData)

        const parsedCategories = Array.isArray(categoriesRes.data?.categories)
          ? categoriesRes.data.categories
          : [];
        setCatalogCategories(parsedCategories);

        if (!showcaseData.config || showcaseData.config.enabled === false) {
          setStoreMenuItems([])
          return
        }

        const useParentCategories = Boolean(settingsRes.data?.navMenuUseParentCategories);
        setNavMenuUseParentCategories(useParentCategories);

        const advancedItems = resolveStoreNavMenuItems(
          {
            navMenuUseParentCategories: useParentCategories,
            navMenuItems: settingsRes.data?.navMenuItems,
          },
          parsedCategories,
        );
        const legacyItems = Array.isArray(navbarRes.data?.items)
          ? navbarRes.data.items.map((item) => ({
              name: String(item?.name || item?.label || '').trim(),
              link: String(item?.link || item?.url || '#').trim() || '#',
              icon: String(item?.icon || '').trim(),
              hasDropdown: false,
              categoryId: String(item?.categoryId || '').trim(),
              megaMenu: { linkColumns: 1, links: [], images: [] },
            }))
          : []

        setStoreMenuItems(
          useParentCategories
            ? advancedItems
            : (advancedItems.length ? advancedItems : legacyItems),
        )
        const resolvedMenuStyle = settingsRes.data?.navMenuStyle && typeof settingsRes.data.navMenuStyle === 'object'
          ? settingsRes.data.navMenuStyle
          : {}
        setMenuStyle((prev) => ({
          ...prev,
          showcaseFlyoutBackgroundColor: String(resolvedMenuStyle.showcaseFlyoutBackgroundColor || prev.showcaseFlyoutBackgroundColor),
          showcaseFlyoutTitleColor: String(resolvedMenuStyle.showcaseFlyoutTitleColor || prev.showcaseFlyoutTitleColor),
          showcaseFlyoutLinkColor: String(resolvedMenuStyle.showcaseFlyoutLinkColor || prev.showcaseFlyoutLinkColor),
          showcaseFlyoutHoverColor: String(resolvedMenuStyle.showcaseFlyoutHoverColor || prev.showcaseFlyoutHoverColor),
          showcaseFlyoutBorderColor: String(resolvedMenuStyle.showcaseFlyoutBorderColor || prev.showcaseFlyoutBorderColor),
        }))
      } catch {
        setData({ config: null, sectionProducts: [], products: [], categories: [] })
        setStoreMenuItems([])
      } finally {
        setLoading(false)
      }
    }
    const handleMenuUpdated = () => {
      load()
    }
    window.addEventListener('navMenuUpdated', handleMenuUpdated)

    if (!(skipInitialFetch && initialShowcaseData)) {
      load()
    }

    return () => {
      window.removeEventListener('navMenuUpdated', handleMenuUpdated)
    }
  }, [initialShowcaseData, initialStoreSettings, skipInitialFetch])

  const config = data.config
  const categoryMenuItems = useMemo(() => {
    const categories = Array.isArray(data?.categories) ? data.categories : []

    return categories
      .filter((category) => String(category?.name || '').trim())
      .slice(0, 12)
      .map((category) => ({
        title: cleanDisplayText(String(category.name || '').trim()),
        href: getCategoryHref(category),
        iconImage: String(category?.icon || category?.image || category?.iconUrl || '').trim(),
        icon: getCategoryIconByName(category?.name),
      }))
  }, [data?.categories])

  const storeNavigationItems = useMemo(() => {
    const navItems = (Array.isArray(storeMenuItems) ? storeMenuItems : [])
      .map((item) => ({
        title: cleanDisplayText(String(item?.name || item?.label || '').trim()),
        href: String(item?.link || item?.url || '#').trim() || '#',
        hasDropdown: Boolean(item?.hasDropdown),
        dropdownLinks: Array.isArray(item?.megaMenu?.links) ? item.megaMenu.links : [],
        dropdownImages: Array.isArray(item?.megaMenu?.images) ? item.megaMenu.images : [],
        linkColumns: Number(item?.megaMenu?.linkColumns) > 0 ? Number(item.megaMenu.linkColumns) : 1,
        iconImage: String(item?.icon || item?.image || item?.iconUrl || '').trim(),
        icon: getCategoryIconByName(item?.name || item?.label),
      }))
      .filter((item) => item.title)

    if (navMenuUseParentCategories) return navItems

    return navItems.length ? navItems : categoryMenuItems
  }, [categoryMenuItems, navMenuUseParentCategories, storeMenuItems])

  const bannerBlocks = useMemo(() => ([
    {
      href: config?.topBannerLink || '/shop',
      image: config?.topBannerImage || '',
      title: config?.topBannerTitle || '',
      showTitle: typeof config?.topBannerTitleEnabled === 'boolean' ? config.topBannerTitleEnabled : true,
      subtitle: config?.topBannerSubtitle || '',
      showSubtitle: typeof config?.topBannerSubtitleEnabled === 'boolean' ? config.topBannerSubtitleEnabled : true,
      ctaText: config?.topBannerCtaText || '',
      showCta: typeof config?.topBannerCtaEnabled === 'boolean' ? config.topBannerCtaEnabled : true,
      ctaBgColor: config?.topBannerCtaBgColor || '#ef2d2d',
      ctaTextColor: config?.topBannerCtaTextColor || '#ffffff',
      accent: 'from-sky-200 via-sky-100 to-white',
      textColor: 'text-white',
      ctaClass: 'bg-rose-600 hover:bg-rose-700',
      imageClass: 'object-cover object-center'
    },
    {
      href: config?.bottomBannerLink || '/shop',
      image: config?.bottomBannerImage || '',
      title: config?.bottomBannerTitle || '',
      showTitle: typeof config?.bottomBannerTitleEnabled === 'boolean' ? config.bottomBannerTitleEnabled : true,
      subtitle: config?.bottomBannerSubtitle || '',
      showSubtitle: typeof config?.bottomBannerSubtitleEnabled === 'boolean' ? config.bottomBannerSubtitleEnabled : true,
      ctaText: config?.bottomBannerCtaText || '',
      showCta: typeof config?.bottomBannerCtaEnabled === 'boolean' ? config.bottomBannerCtaEnabled : true,
      ctaBgColor: config?.bottomBannerCtaBgColor || '#ef2d2d',
      ctaTextColor: config?.bottomBannerCtaTextColor || '#ffffff',
      accent: 'from-[#180000] via-[#520000] to-[#d61f1f]',
      textColor: 'text-white',
      ctaClass: 'bg-rose-600 hover:bg-rose-700',
      imageClass: 'object-cover object-center'
    }
  ]), [config])

  const hoveredMenuItem = useMemo(() => {
    if (hoveredMenuIndex == null) return null
    return storeNavigationItems[hoveredMenuIndex] || null
  }, [hoveredMenuIndex, storeNavigationItems])

  const hoveredDropdownLinks = useMemo(() => {
    const links = Array.isArray(hoveredMenuItem?.dropdownLinks) ? hoveredMenuItem.dropdownLinks : []
    return links
      .map((dropdownItem, dropdownIndex) => ({
        title: cleanDisplayText(
          String(
            dropdownItem?.title || dropdownItem?.label || dropdownItem?.name || `Option ${dropdownIndex + 1}`,
          ).trim(),
        ),
        href: String(dropdownItem?.link || dropdownItem?.url || '#').trim() || '#',
      }))
      .filter((dropdownItem) => dropdownItem.title)
  }, [hoveredMenuItem])

  const hoveredDropdownImages = useMemo(() => {
    const images = Array.isArray(hoveredMenuItem?.dropdownImages) ? hoveredMenuItem.dropdownImages : []
    return images
      .map((imageItem) => ({
        src: String(imageItem?.url || imageItem?.image || imageItem?.src || '').trim(),
        alt: cleanDisplayText(String(imageItem?.label || '').trim()),
        href: String(imageItem?.link || '#').trim() || '#',
      }))
      .filter((imageItem) => imageItem.src)
  }, [hoveredMenuItem])

  useEffect(() => {
    return () => {
      clearFlyoutCloseTimer()
    }
  }, [])

  useEffect(() => {
    const scroll = menuScrollRef.current
    if (!scroll || hoveredMenuIndex == null) return undefined

    const handleScroll = () => updateFlyoutPosition(hoveredMenuIndex)
    scroll.addEventListener('scroll', handleScroll, { passive: true })
    return () => scroll.removeEventListener('scroll', handleScroll)
  }, [hoveredMenuIndex])

  useEffect(() => {
    if (hoveredMenuIndex == null) return undefined

    const handleResize = () => updateFlyoutPosition(hoveredMenuIndex)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [hoveredMenuIndex])

  if (loading) return <ShopShowcaseSkeleton navbarBg={navbarBg} />
  if (!config || config.enabled === false) return null

  const showCategoryFlyout = Boolean(hoveredMenuItem?.hasDropdown && hoveredDropdownLinks.length)

  return (
    <section className={`${HOME_SECTION_CLASS} max-w-[1400px] mx-auto px-4 sm:px-6`}>
      <div className="grid grid-cols-1 gap-3 overflow-visible lg:grid-cols-[280px_minmax(0,1fr)]">
        <div
          ref={menuContainerRef}
          className="relative z-30 hidden min-h-0 overflow-visible lg:block"
          style={{ width: showCategoryFlyout ? 560 : undefined }}
          onMouseEnter={clearFlyoutCloseTimer}
          onMouseLeave={scheduleFlyoutClose}
        >
          <aside className="absolute inset-y-0 left-0 flex w-[280px] min-h-0 flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm">
            <div
              className="flex items-center justify-between px-4 py-3 text-white"
              style={{ backgroundColor: navbarBg }}
              onMouseEnter={() => {
                clearFlyoutCloseTimer()
                setHoveredMenuIndex(null)
              }}
            >
              <div className="flex items-center gap-2 text-[14px] font-semibold">
                <span className="text-lg leading-none">☰</span>
                <span>All Categories</span>
              </div>
              <ChevronRight size={18} className="text-white/70" />
            </div>

            <div
              ref={menuScrollRef}
              className={styles.leftMenuScroll}
              onMouseEnter={(event) => {
                if (event.target === event.currentTarget) {
                  clearFlyoutCloseTimer()
                  setHoveredMenuIndex(null)
                }
              }}
            >
              {storeNavigationItems.map((menuItem, index) => {
                const isActive = hoveredMenuIndex === index
                const hasFlyout = Boolean(menuItem.hasDropdown && menuItem.dropdownLinks.length)

                return (
                  <div
                    key={`${menuItem.title}-${menuItem.href}-${index}`}
                    ref={(element) => {
                      menuItemRefs.current[index] = element
                    }}
                    className="border-b border-slate-200"
                    onMouseEnter={() => handleMenuItemHover(index)}
                  >
                    <Link
                      href={menuItem.href}
                      className={`flex items-center gap-3 px-4 py-3 text-[13px] text-slate-800 transition-colors duration-200 ${
                        isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      {isIconImageUrl(menuItem.iconImage) ? (
                        <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-sm">
                          <img
                            src={menuItem.iconImage}
                            alt={menuItem.title}
                            className="h-4 w-4 object-contain"
                            loading="lazy"
                          />
                        </span>
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center text-slate-700">
                          <menuItem.icon size={16} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 pr-2">
                        <span className="block text-[13px] leading-5 font-medium">{menuItem.title}</span>
                      </span>
                      <ChevronRight
                        size={16}
                        className={`${hasFlyout ? 'text-slate-700' : 'text-slate-400'}`}
                      />
                    </Link>
                  </div>
                )
              })}
            </div>
          </aside>

          {showCategoryFlyout ? (
            <>
              <div
                className="absolute z-10"
                style={{
                  left: 276,
                  top: flyoutPosition.top,
                  width: 8,
                  height: flyoutPosition.maxHeight,
                }}
                onMouseEnter={clearFlyoutCloseTimer}
                aria-hidden
              />
              <div
                className="absolute left-[279px] z-20 flex w-[280px] flex-col overflow-hidden rounded-none border border-slate-200 shadow-sm"
                style={{
                  top: flyoutPosition.top,
                  maxHeight: flyoutPosition.maxHeight,
                  backgroundColor: menuStyle.showcaseFlyoutBackgroundColor,
                  borderColor: menuStyle.showcaseFlyoutBorderColor,
                }}
                onMouseEnter={clearFlyoutCloseTimer}
              >
                <div className={`grid min-h-0 flex-1 ${hoveredDropdownImages.length ? 'grid-cols-[minmax(0,1fr)_120px]' : 'grid-cols-1'}`}>
                  <div className="min-h-0 min-w-0 overflow-y-auto">
                    {hoveredDropdownLinks.map((dropdownItem, dropdownIndex) => (
                      <Link
                        key={`${dropdownItem.title}-${dropdownItem.href}-${dropdownIndex}`}
                        href={dropdownItem.href}
                        className="group flex items-center justify-between border-b px-4 py-3 text-[13px] font-medium leading-5 transition-colors"
                        style={{
                          color: menuStyle.showcaseFlyoutLinkColor,
                          borderColor: menuStyle.showcaseFlyoutBorderColor,
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.backgroundColor = menuStyle.showcaseFlyoutHoverColor
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <span className="truncate pr-3">{dropdownItem.title}</span>
                        <ChevronRight size={16} className="shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </Link>
                    ))}
                  </div>

                  {hoveredDropdownImages.length ? (
                    <div
                      className="space-y-2 border-l p-2"
                      style={{
                        borderColor: menuStyle.showcaseFlyoutBorderColor,
                        backgroundColor: menuStyle.showcaseFlyoutHoverColor,
                      }}
                    >
                      {hoveredDropdownImages.slice(0, 2).map((imageItem, imageIndex) => (
                        <Link
                          key={`${imageItem.src}-${imageIndex}`}
                          href={imageItem.href}
                          className="group relative block overflow-hidden rounded-lg border"
                          style={{ borderColor: menuStyle.showcaseFlyoutBorderColor }}
                        >
                          <img
                            src={imageItem.src}
                            alt={imageItem.alt || hoveredMenuItem?.title || 'Featured image'}
                            className="h-[88px] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                          {imageItem.alt ? (
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-1.5">
                              <p className="truncate text-[10px] font-semibold text-white">{imageItem.alt}</p>
                            </div>
                          ) : null}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className={bannerStyles.bannerGrid}>
          {bannerBlocks.map((banner, index) => (
            (() => {
              const bannerImage = getOriginalImageUrl(banner.image)
              const hasImage = Boolean(bannerImage)

              return (
            <Link
              key={`${banner.title}-${index}`}
              href={banner.href}
              className={`group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm ${bannerStyles.bannerRow}`}
              style={index === 0 ? { gridRow: '1 / 2' } : { gridRow: '2 / 3' }}
            >
              {hasImage ? (
                <img
                  src={bannerImage}
                  alt={banner.title}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  className={`absolute inset-0 h-full w-full ${banner.imageClass}`}
                />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-r ${banner.accent}`} />
              )}

              {!hasImage ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-black/26 via-black/6 to-transparent" />

                  <div className="absolute inset-0 flex items-center px-5 py-4 sm:px-8">
                    <div className="max-w-[360px] rounded-xl bg-black/10 px-3 py-2 backdrop-blur-[1.5px]">
                      {banner.showTitle && String(banner.title || '').trim() ? (
                        <p className="text-[26px] font-black leading-[1.05] tracking-tight text-white sm:text-[34px]">
                          {banner.title}
                        </p>
                      ) : null}
                      {banner.showSubtitle && String(banner.subtitle || '').trim() ? (
                        <p className="mt-2 text-[14px] font-medium text-white/90 sm:text-[16px]">
                          {banner.subtitle}
                        </p>
                      ) : null}
                      {banner.showCta && String(banner.ctaText || '').trim() ? (
                        <div
                          className="mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-semibold shadow-sm transition duration-200"
                          style={{ backgroundColor: banner.ctaBgColor, color: banner.ctaTextColor }}
                        >
                          {index === 0 ? <Truck size={16} /> : <Search size={16} />}
                          <span>{banner.ctaText}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}
            </Link>
              )
            })()
          ))}
        </div>

        {/* 4-grid product/banner section below main banners */}
        <div className={`${productGridStyles.showcaseProductGrid} lg:col-span-2`}>
          {[0,1,2,3].map((i) => (
            (() => {
              const banner = data.config?.productBanners?.[i] || {}
              const link = String(banner.link || '').trim()
              const Card = link ? Link : 'div'

              return (
                <Card
                  key={i}
                  href={link || undefined}
                  className={productGridStyles.showcaseProductCard}
                >
              <img
                className={productGridStyles.showcaseProductImage}
                src={banner.image || '/assets/placeholder.png'}
                alt={banner.title || 'Product'}
              />
              <div className={productGridStyles.showcaseProductOverlay} />
              <div className={productGridStyles.showcaseProductContent}>
                {String(banner.title || '').trim() ? (
                  <div className={productGridStyles.showcaseProductTitle}>
                    {banner.title}
                  </div>
                ) : null}
                {String(banner.subtitle || '').trim() ? (
                  <div className={productGridStyles.showcaseProductSubtitle}>
                    {banner.subtitle}
                  </div>
                ) : null}
                {String(banner.buttonText || '').trim() ? (
                  <span className={productGridStyles.showcaseProductButton}>
                    {banner.buttonText}
                  </span>
                ) : null}
              </div>
                </Card>
              )
            })()
          ))}
        </div>
      </div>
    </section>
  )
}


