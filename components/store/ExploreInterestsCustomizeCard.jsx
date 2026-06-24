'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Compass, Loader } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import axios from 'axios'

export default function ExploreInterestsCustomizeCard() {
  const { getToken, user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [productCount, setProductCount] = useState(0)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }

    let active = true

    const load = async () => {
      try {
        const token = await getToken()
        if (!token || !active) return
        const { data } = await axios.get('/api/store/explore-interests', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!active) return
        setEnabled(typeof data?.enabled === 'boolean' ? data.enabled : true)
        setProductCount(Array.isArray(data?.productIds) ? data.productIds.length : 0)
      } catch {
        if (!active) return
        setEnabled(true)
        setProductCount(0)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [authLoading, user?.uid, getToken])

  return (
    <Link
      href="/store/explore-interests"
      className="group block overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 shadow-sm transition hover:border-violet-300 hover:shadow-md"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
            <Compass size={14} />
            Explore your interests
          </div>
          <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
            Choose Recommended products manually
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Pick exactly which products appear when customers click the <strong>Recommended</strong> tab on your homepage.
            Other category chips still use your catalog automatically.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-500">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader size={14} className="animate-spin" />
                Loading current selection...
              </span>
            ) : (
              <>
                <span className="text-violet-700">{productCount} product{productCount === 1 ? '' : 's'} selected</span>
                {' · '}
                {enabled ? 'Section is live on storefront' : 'Section is hidden'}
              </>
            )}
          </p>
        </div>

        <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-violet-700 sm:self-center">
          Choose products
          <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  )
}
