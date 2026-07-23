'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import {
  MOBILE_HOME_BANNER_APIS,
  MOBILE_HOME_BOOTSTRAP_API,
  MOBILE_HOME_LAYOUT_SECTIONS,
} from '@/lib/mobileHomeApis'

export default function MobileHomeApisPanel() {
  const websiteApis = [
    MOBILE_HOME_BOOTSTRAP_API,
    ...MOBILE_HOME_LAYOUT_SECTIONS.filter((s) => s.sameAsWebsite),
  ]
  const appApis = MOBILE_HOME_BANNER_APIS

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold text-slate-900">
          Home APIs for the mobile app
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
          Green = same as website home. Drag order in the phone preview; the app reads{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">homeLayout</code> from{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">GET /api/public/mobile-features</code>.
        </p>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Same as website home
          </h3>
          <ul className="mt-2 space-y-2">
            {websiteApis.map((api) => (
              <li
                key={api.id}
                className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2"
              >
                <p className="text-xs font-semibold text-slate-800">{api.label}</p>
                <p className="mt-0.5 break-all font-mono text-[10px] text-slate-600">
                  {api.method} {api.path}
                </p>
                {api.notes ? (
                  <p className="mt-1 text-[10px] text-slate-500">{api.notes}</p>
                ) : null}
                {api.configureHref ? (
                  <Link
                    href={api.configureHref}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 hover:underline"
                  >
                    Configure <ExternalLink size={10} />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            App banner endpoints + layout
          </h3>
          <ul className="mt-2 space-y-2">
            {appApis.map((api) => (
              <li
                key={api.id}
                className="rounded-lg border border-sky-100 bg-sky-50/40 px-3 py-2"
              >
                <p className="text-xs font-semibold text-slate-800">{api.label}</p>
                <p className="mt-0.5 break-all font-mono text-[10px] text-slate-600">
                  {api.method} {api.path}
                </p>
                {api.notes ? (
                  <p className="mt-1 text-[10px] text-slate-500">{api.notes}</p>
                ) : null}
                {api.configureHref ? (
                  <Link
                    href={api.configureHref}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 hover:underline"
                  >
                    Edit <ExternalLink size={10} />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
