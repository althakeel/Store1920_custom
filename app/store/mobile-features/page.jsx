'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import {
  ArrowRight,
  Images,
  LayoutGrid,
  RectangleHorizontal,
  Smartphone,
  SquareStack,
} from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { normalizeMobileFeatures } from '@/lib/mobileFeatures'
import { MobileHomeLayoutPreviewConnected } from '@/components/store/MobileHomeLayoutPreview'
import MobileHomeApisPanel from '@/components/store/MobileHomeApisPanel'

const designPages = [
  {
    key: 'bannerSlider',
    title: 'Large App Banners',
    description: 'Hero slider at the top of the app home screen. Height, auto-slide, up to 8 slides.',
    href: '/store/mobile-features/banners',
    icon: Images,
    api: '/api/store/mobile-banner-slider',
  },
  {
    key: 'smallBanners',
    title: 'Small Promo Banners',
    description: 'Thin promo strips under the hero. Up to 12 slides.',
    href: '/store/mobile-features/small-banners',
    icon: RectangleHorizontal,
    api: '/api/store/mobile-small-banners',
  },
  {
    key: 'promoCards',
    title: 'Promo Card Banners',
    description: 'Larger promo cards with optional Ad badge. Up to 8 slides.',
    href: '/store/mobile-features/promo-cards',
    icon: SquareStack,
    api: '/api/store/mobile-promo-cards',
  },
  {
    key: 'tileBanners',
    title: 'Category Tile Banners',
    description: 'Two-column category tiles with title, subtitle, and button. Up to 12 tiles.',
    href: '/store/mobile-features/tile-banners',
    icon: LayoutGrid,
    api: '/api/store/mobile-tile-banners',
  },
]

export default function MobileFeaturesPage() {
  const { getToken } = useAuth()
  const [features, setFeatures] = useState(() => normalizeMobileFeatures())

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      const { data } = await axios.get('/api/store/mobile-features', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setFeatures(normalizeMobileFeatures(data?.mobileFeatures))
    } catch (error) {
      console.error(error)
    }
  }, [getToken])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="-mx-3 -mt-3 min-h-full w-full max-w-full overflow-x-hidden bg-white pb-12 sm:-mx-4 sm:-mt-4 lg:-mx-5 lg:-mt-5">
      <div className="border-b border-sky-100 bg-gradient-to-r from-sky-700 via-sky-600 to-cyan-600 px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          <Smartphone size={14} />
          Mobile Features
        </div>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl lg:text-4xl">Mobile App Home Design</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-50 sm:text-base">
          Drag the phone preview to set home order. The app uses the <strong>same website home APIs</strong> for
          showcase, categories, featured products, deals, and explore — plus optional app banner sections.
          Saved order is in <code className="rounded bg-white/15 px-1.5 py-0.5 text-xs">homeLayout</code> on{' '}
          <code className="rounded bg-white/15 px-1.5 py-0.5 text-xs">/api/public/mobile-features</code>.
        </p>
      </div>

      <div className="grid gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:px-8 lg:py-8">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">App-only banner editors</h2>
              <p className="mt-1 text-sm text-slate-500">
                Optional creatives. Website content blocks (showcase, products, deals) are ordered in the phone preview
                and use the same public APIs as the website.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-6">
              {designPages.map((item) => {
                const Icon = item.icon
                const section = features[item.key]
                const listKey = item.key === 'tileBanners' ? 'tiles' : 'slides'
                const count = Array.isArray(section?.[listKey]) ? section[listKey].length : 0
                const on = section?.enabled !== false && count > 0

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 hover:shadow-sm sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 sm:h-11 sm:w-11">
                        <Icon size={20} />
                      </div>
                      <ArrowRight
                        size={18}
                        className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-sky-700"
                      />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-slate-900 sm:text-base">{item.title}</h3>
                    <p className="mt-1.5 flex-1 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">
                      {item.description}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {on ? `${count} visible` : 'Hidden'}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">{item.api}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          <MobileHomeApisPanel />
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 lg:sticky lg:top-4">
          <MobileHomeLayoutPreviewConnected />
        </aside>
      </div>
    </div>
  )
}
