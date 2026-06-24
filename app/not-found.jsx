'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getProductThumbnailUrl } from '@/lib/productMedia'
import { PRODUCT_CARD_GRID_CLASS_4, PRODUCT_CARD_CELL_CLASS } from '@/lib/storefrontCarousel'
import { getProductPath } from '@/lib/productUrl'

const FALLBACK_IMAGE = 'https://store1920-images.s3.ap-south-1.amazonaws.com/uploads/placeholder.png'

const getProductImage = (product) => getProductThumbnailUrl(product, { fallback: FALLBACK_IMAGE })

const getProductPrice = (product) => {
  const value = Number(product?.price ?? 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export default function NotFound() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadProducts = async () => {
      try {
        const response = await fetch('/api/products?limit=8', { cache: 'no-store' })
        const data = await response.json()
        if (!active) return
        const productList = Array.isArray(data?.products) ? data.products : []
        setProducts(productList.filter((item) => item?.slug || item?._id).slice(0, 8))
      } catch {
        if (active) setProducts([])
      } finally {
        if (active) setLoading(false)
      }
    }

    loadProducts()
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f3f4f8] pb-16">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(255,59,59,0.16),transparent_35%),radial-gradient(circle_at_92%_8%,rgba(17,76,210,0.2),transparent_30%),linear-gradient(180deg,#f7f8fc_0%,#eef1f9_100%)]" />
      </div>

      <div className="relative mx-auto max-w-[1320px] px-4 pt-8 sm:px-6 sm:pt-12">
        <section className="grid gap-5 overflow-hidden rounded-[30px] border border-[#d8deee] bg-white shadow-[0_20px_60px_rgba(19,35,84,0.08)] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-7 sm:p-10 lg:p-12">
            <p className="inline-flex items-center rounded-full border border-[#ffdddd] bg-[#fff3f3] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#d12d2d]">
              Wrong Turn
            </p>

            <h1 className="mt-4 text-balance text-4xl font-black leading-[0.95] text-[#15203b] sm:text-6xl lg:text-7xl" style={{ fontFamily: 'Poppins, Montserrat, sans-serif' }}>
              This Page
              <span className="block text-[#2452cf]">Does Not Exist</span>
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Looks like this URL vanished. Good news: your shopping flow does not have to stop here.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-xl bg-[#d92626] px-6 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(217,38,38,0.3)] transition hover:-translate-y-0.5 hover:bg-[#b81f1f]"
              >
                Go Home
              </Link>
              <Link
                href="/shop"
                className="rounded-xl border border-[#ccd6ef] bg-[#f8faff] px-6 py-3 text-sm font-semibold text-[#1d3f98] transition hover:bg-[#edf2ff]"
              >
                Shop Products
              </Link>
            </div>
          </div>

          <div className="relative min-h-[220px] overflow-hidden bg-[linear-gradient(145deg,#0f2f89_0%,#245be3_55%,#4f7ef3_100%)] p-8 sm:min-h-[300px] sm:p-10">
            <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
            <div className="absolute -bottom-10 -left-8 h-44 w-44 rounded-full bg-[#ff5c5c]/20 blur-2xl" />

            <div className="relative h-full">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-100/90">Error Code</p>
              <p className="mt-3 text-7xl font-black leading-none text-white sm:text-8xl md:text-9xl">404</p>
              <p className="mt-2 max-w-[18rem] text-sm font-medium text-blue-100/95">
                While you are here, check what shoppers are buying right now.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[26px] border border-[#dbe2f2] bg-white p-5 shadow-[0_12px_30px_rgba(18,39,84,0.05)] sm:p-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2148b4]">Trending Picks</p>
              <h2 className="text-xl font-black text-[#12203f] sm:text-2xl" style={{ fontFamily: 'Poppins, Montserrat, sans-serif' }}>
                Keep Shopping
              </h2>
            </div>
            <Link href="/shop" className="text-sm font-bold text-[#1f4ad0] hover:text-[#14349f]">
              View catalog
            </Link>
          </div>

          {loading ? (
            <div className={PRODUCT_CARD_GRID_CLASS_4}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className={`${PRODUCT_CARD_CELL_CLASS} overflow-hidden rounded-2xl border border-slate-100 bg-white`}>
                  <div className="aspect-square animate-pulse bg-slate-100" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
                    <div className="h-4 w-2/5 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className={PRODUCT_CARD_GRID_CLASS_4}>
              {products.map((product, index) => {
                const href = getProductPath(product)
                const price = getProductPrice(product)

                return (
                  <Link
                    key={product._id || product.slug}
                    href={href}
                    className={`${PRODUCT_CARD_CELL_CLASS} group block h-full overflow-hidden rounded-2xl border border-[#e3e8f4] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(14,42,110,0.12)]`}
                    style={{ animation: `riseIn 420ms ease ${index * 55}ms both` }}
                  >
                    <div className="relative aspect-square overflow-hidden bg-[linear-gradient(180deg,#f6f8ff_0%,#edf1fb_100%)]">
                      <img
                        src={getProductImage(product)}
                        alt={product?.name || 'Product image'}
                        className="h-full w-full object-contain p-3 transition duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <div className="space-y-2 p-3">
                      <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-[#1b2440]">
                        {product?.name || 'Product'}
                      </p>
                      <p className="text-base font-black text-[#d92626]">AED {price.toLocaleString()}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#ccd8f3] bg-[#f8faff] p-8 text-center">
              <p className="text-sm text-slate-600">Recommendations are not available right now.</p>
              <Link href="/shop" className="mt-3 inline-block text-sm font-bold text-[#1f4ad0] hover:text-[#14349f]">
                Browse full catalog
              </Link>
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        @keyframes riseIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
