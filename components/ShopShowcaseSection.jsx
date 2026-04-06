'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import Link from 'next/link'
import Image from 'next/image'

function formatCountdown(target) {
  if (!target) return null
  const end = Date.parse(target)
  if (Number.isNaN(end)) return null

  const diff = Math.max(0, end - Date.now())
  const totalSec = Math.floor(diff / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h}h : ${m}m : ${s}s`
}

function getCategoryHref(category) {
  if (category?.slug) return `/shop?category=${encodeURIComponent(category.slug)}`
  if (category?._id) return `/shop?category=${encodeURIComponent(String(category._id))}`
  return '/shop'
}

function getProductHref(product) {
  if (product?.slug) return `/product/${product.slug}`
  if (product?._id) return `/product/${String(product._id)}`
  return '/shop'
}

function getProductImage(product) {
  if (Array.isArray(product?.images) && product.images[0]) return product.images[0]
  return ''
}

function formatPrice(product) {
  const amount = Number(product?.price ?? product?.AED ?? 0)
  return `AED ${amount.toFixed(2)}`
}

export default function ShopShowcaseSection() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ config: null, sectionProducts: [], products: [], categories: [] })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get('/api/public/shop-showcase')
        setData(res.data || { config: null, sectionProducts: [], products: [], categories: [] })
      } catch {
        setData({ config: null, sectionProducts: [], products: [], categories: [] })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const config = data.config
  const countdownText = useMemo(() => formatCountdown(config?.countdownEnd), [config?.countdownEnd, tick])
  const dealsBackgrounds = ['#f8fafc', '#eff6ff', '#ecfeff', '#f5f3ff', '#fff7ed']
  const dealsBackgroundColor = dealsBackgrounds[Math.floor(tick / 30) % dealsBackgrounds.length]
  const showcaseProducts = data.products || []
  const leftBlockProducts = data.sectionProducts || []
  const leftBlockUsesProducts = config?.leftBlockSource === 'product' && leftBlockProducts.length > 0
  const leftBlockItems = leftBlockUsesProducts ? leftBlockProducts.slice(0, 4) : (data.categories || []).slice(0, 4)
  const [featuredLeftItem, ...secondaryLeftItems] = leftBlockItems
  const leftBlockCountLabel = (config?.leftBlockBadgeText || `${leftBlockItems.length}`.padStart(2, '0')).trim()
  const rotatingProducts = useMemo(() => {
    if (!showcaseProducts.length) return []

    const pageSize = 4
    const totalPages = Math.ceil(showcaseProducts.length / pageSize)
    const pageIndex = Math.floor(tick / 30) % totalPages
    const start = pageIndex * pageSize
    const chunk = showcaseProducts.slice(start, start + pageSize)

    if (chunk.length === pageSize || showcaseProducts.length <= pageSize) {
      return chunk
    }

    return [...chunk, ...showcaseProducts.slice(0, pageSize - chunk.length)]
  }, [showcaseProducts, tick])

  if (loading || !config || config.enabled === false) return null

  return (
    <section className="max-w-[1400px] mx-auto px-4 sm:px-6 mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3 text-slate-900">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {leftBlockUsesProducts ? 'Selected Products' : 'Selected Categories'}
              </p>
              <h3 className="mt-1 text-lg font-extrabold leading-5 tracking-tight">
                {config.sectionTitle || 'More Reasons to Shop'}
              </h3>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {leftBlockCountLabel}
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            {featuredLeftItem ? (
              <Link
                href={leftBlockUsesProducts ? getProductHref(featuredLeftItem) : getCategoryHref(featuredLeftItem)}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_5px_rgba(15,23,42,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(15,23,42,0.14)]"
              >
                <div className="relative h-[190px] overflow-hidden bg-white">
                  {(leftBlockUsesProducts ? getProductImage(featuredLeftItem) : featuredLeftItem.image) ? (
                    <Image
                      src={leftBlockUsesProducts ? getProductImage(featuredLeftItem) : featuredLeftItem.image}
                      alt={featuredLeftItem.name || (leftBlockUsesProducts ? 'Product' : 'Category')}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-[1.05]"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
                  <span className="absolute left-3 top-3 rounded border border-slate-200 bg-white/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                    {leftBlockUsesProducts ? 'Featured Product' : 'Featured Category'}
                  </span>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="line-clamp-2 text-[15px] font-extrabold leading-5 text-white">
                    {featuredLeftItem.name}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                      {leftBlockUsesProducts ? 'Shop this pick' : 'Open collection'}
                    </p>
                    {leftBlockUsesProducts ? (
                      <p className="text-[14px] font-black text-emerald-300">
                        {formatPrice(featuredLeftItem)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Link>
            ) : null}

            <div className="grid flex-1 grid-cols-2 gap-2.5">
              {secondaryLeftItems.map((item) => (
                <Link
                  key={String(item._id)}
                  href={leftBlockUsesProducts ? getProductHref(item) : getCategoryHref(item)}
                  className="group flex min-h-[132px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_5px_rgba(15,23,42,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(15,23,42,0.14)]"
                >
                  <div className="relative h-[84px] overflow-hidden bg-white">
                    {(leftBlockUsesProducts ? getProductImage(item) : item.image) ? (
                      <Image
                        src={leftBlockUsesProducts ? getProductImage(item) : item.image}
                        alt={item.name || (leftBlockUsesProducts ? 'Product' : 'Category')}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-[1.04]"
                      />
                    ) : null}
                    <span className="absolute left-2 top-2 rounded border border-slate-200 bg-white/95 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                      {leftBlockUsesProducts ? 'Product' : 'Category'}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col px-2.5 py-2.5">
                    <p className="line-clamp-2 text-[12px] font-semibold leading-4 text-slate-800">
                      {item.name}
                    </p>
                    <div className="mt-auto pt-2 text-[11px] font-bold text-slate-500">
                      {leftBlockUsesProducts ? formatPrice(item) : 'Explore'}
                    </div>
                  </div>
                </Link>
              ))}

              <Link
                href="/shop"
                className="flex min-h-[132px] flex-col justify-between rounded-xl border border-dashed border-slate-300 bg-white p-3 transition hover:bg-slate-50"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Discover More
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {leftBlockUsesProducts ? 'See all products' : 'Browse all categories'}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    Explore the full storefront collection.
                  </p>
                </div>
                <span className="text-lg text-slate-400">→</span>
              </Link>
            </div>
          </div>
        </div>

        <div
          className="rounded-xl p-3 shadow-sm border border-slate-200 transition-colors duration-700"
          style={{ backgroundColor: dealsBackgroundColor }}
        >
          <div className="flex items-center justify-between mb-3 text-slate-900">
            <h3 className="font-extrabold text-lg tracking-tight">{config.dealsTitle || 'MEGA DEALS'}</h3>
            {countdownText ? <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-semibold">{countdownText}</span> : null}
          </div>

          <div className="grid grid-cols-2 gap-2.5 auto-rows-fr">
            {rotatingProducts.map((product) => (
              <Link
                key={String(product._id)}
                href={getProductHref(product)}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_5px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(15,23,42,0.14)]"
              >
                <div className="relative h-32 sm:h-36 bg-slate-100 overflow-hidden">
                  {product.images?.[0] ? (
                    <Image src={product.images[0]} alt={product.name || 'Product'} fill className="object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                  ) : null}

                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-white/90 text-slate-700 border border-slate-200">
                    Deal
                  </span>
                </div>

                <div className="flex flex-1 flex-col bg-white p-2.5">
                  <p className="min-h-[34px] text-[12px] font-medium leading-4 text-slate-800 line-clamp-2">
                    {product.name}
                  </p>

                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p className="text-[20px] font-black leading-none text-rose-600">AED {Number(product.price || 0).toFixed(2)}</p>
                    <p className="pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Offer</p>
                  </div>

                  <div className="mt-auto pt-2">
                    <div className="w-full rounded-md border border-slate-300 bg-slate-50 py-1.5 text-center text-[10px] font-bold text-slate-700 group-hover:bg-slate-100">
                    View Product
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-rows-2 gap-3">
          <Link href={config.topBannerLink || '/shop'} className="relative rounded-xl overflow-hidden min-h-[170px]">
            {config.topBannerImage ? (
              <Image src={config.topBannerImage} alt="Top banner" fill className="object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-emerald-600" />
            )}
          </Link>

          <Link href={config.bottomBannerLink || '/shop'} className="relative rounded-xl overflow-hidden min-h-[170px]">
            {config.bottomBannerImage ? (
              <Image src={config.bottomBannerImage} alt="Bottom banner" fill className="object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-sky-400 to-cyan-300" />
            )}
          </Link>
        </div>
      </div>
    </section>
  )
}
