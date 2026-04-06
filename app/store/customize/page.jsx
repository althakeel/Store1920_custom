'use client'

import Link from 'next/link'
import {
  ArrowRight,
  LayoutTemplate,
  Palette,
  PanelsTopLeft,
  Menu,
  Rows3,
  Images,
  Sparkles,
  Grid2x2,
  Package,
  Shapes,
} from 'lucide-react'

const designPages = [
  {
    title: 'Home Preferences',
    description: 'Control homepage product blocks and design settings in one place.',
    href: '/store/home-preferences',
    icon: Sparkles,
  },
  {
    title: 'Preference',
    description: 'Configure shop showcase banners, highlights, and homepage content.',
    href: '/store/preferences',
    icon: LayoutTemplate,
  },
  {
    title: 'Appearance',
    description: 'Toggle storefront sections and update display behavior.',
    href: '/store/storefront/appearance',
    icon: Palette,
  },
  {
    title: 'Navbar Design',
    description: 'Manage navbar links, upload a logo, and change the navbar background color.',
    href: '/store/navbar-menu',
    icon: PanelsTopLeft,
  },
  {
    title: 'Navbar Menu',
    description: 'Configure navbar layout, sticky behavior, and menu visibility settings.',
    href: '/store/storefront/navbar-menu',
    icon: Menu,
  },
  {
    title: 'Home Categories',
    description: 'Design and configure category blocks shown on the homepage.',
    href: '/store/storefront/home-menu-categories',
    icon: Grid2x2,
  },
  {
    title: 'Carousel Settings',
    description: 'Adjust the homepage carousel display and slider behavior.',
    href: '/store/storefront/carousel-slider',
    icon: Images,
  },
  {
    title: 'Sitemap Categories',
    description: 'Edit the storefront sitemap category section layout.',
    href: '/store/storefront/sitemap-categories',
    icon: Shapes,
  },
]

const selectionPages = [
  {
    title: 'Featured Sections',
    description: 'Select featured collections and section content.',
    href: '/store/category-slider',
    icon: Rows3,
  },
  {
    title: 'Carousel Products',
    description: 'Choose the products shown in the homepage carousel.',
    href: '/store/carousel-slider',
    icon: Images,
  },
  {
    title: 'Featured Products',
    description: 'Select featured products for homepage merchandising.',
    href: '/store/featured-products',
    icon: Package,
  },
]

const Section = ({ title, description, items }) => (
  <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
    <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>

    <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Icon size={20} />
              </div>
              <ArrowRight size={18} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
            </div>

            <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
          </Link>
        )
      })}
    </div>
  </section>
)

export default function CustomizePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-slate-700 sm:px-6 lg:px-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-6 py-8 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
              <Palette size={14} />
              Customize
            </div>
            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Store Design Hub</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50 sm:text-base">
              Open any design or selection page from here to customize the look of your storefront and choose the products, categories, and sections shown to customers.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        <Section
          title="Design Pages"
          description="These pages control the appearance, layout, and section behavior of your storefront."
          items={designPages}
        />

        <Section
          title="Selection Pages"
          description="These pages let you choose the products, categories, and content used in the storefront sections."
          items={selectionPages}
        />
      </div>
    </div>
  )
}