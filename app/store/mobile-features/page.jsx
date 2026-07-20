'use client'

import Link from 'next/link'
import { ArrowRight, Images, Smartphone } from 'lucide-react'

const designPages = [
  {
    title: 'Mobile Banners',
    description: 'Home screen banner slider for the mobile app only. Upload images, links, and autoplay timing.',
    href: '/store/mobile-features/banners',
    icon: Images,
  },
]

function Section({ title, description, items }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-6 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon
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
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default function MobileFeaturesPage() {
  return (
    <div className="-mx-3 -mt-3 min-h-full w-full max-w-full overflow-x-hidden bg-white pb-12 sm:-mx-4 sm:-mt-4 lg:-mx-5 lg:-mt-5">
      <div className="border-b border-sky-100 bg-gradient-to-r from-sky-700 via-sky-600 to-cyan-600 px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          <Smartphone size={14} />
          Mobile Features
        </div>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl lg:text-4xl">Mobile App Design</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-50 sm:text-base">
          Configure designs that appear only in the mobile app — not the website storefront.
          Use the public API <code className="rounded bg-white/15 px-1.5 py-0.5 text-xs">/api/public/mobile-features</code> in the app.
        </p>
      </div>

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Section
          title="Design"
          description="Mobile-only layout options. Web homepage banners stay under Customize / Preferences."
          items={designPages}
        />
      </div>
    </div>
  )
}
