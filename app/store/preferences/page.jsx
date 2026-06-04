'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { useAuth } from '@/lib/useAuth'
import { Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const createProductBanner = (overrides = {}) => ({
  image: '',
  title: '',
  subtitle: '',
  buttonText: '',
  link: '',
  ...overrides,
})

const initialState = {
  enabled: true,
  featuredSectionTitle: 'Craziest sale of the year!',
  featuredSectionDescription: "Grab the best deals before they're gone!",
  sectionTitle: 'More Reasons to Shop',
  leftBlockBadgeText: '',
  leftBlockSource: 'category',
  dealsTitle: 'MEGA DEALS',
  countdownEnd: '',
  categoryIds: [],
  sectionProductIds: [],
  productIds: [],
  mainBannerEnabled: true,
  mainBannerImage: '',
  mainBannerTitle: 'Power up instantly no battery needed',
  mainBannerSubtitle: 'Never stress over a dead battery again',
  mainBannerCtaText: 'Order Now',
  mainBannerLink: '/shop',
  mainBannerLeftColor: '#00112b',
  mainBannerRightColor: '#00112b',
  topBannerImage: '',
  topBannerTitle: 'SUPER SAVES FOR SUMMER',
  topBannerLink: '/shop',
  bottomBannerImage: '',
  bottomBannerTitle: 'Shop Now. Pay Later. Ready for Summer.',
  bottomBannerCtaText: 'Shop Now',
  bottomBannerLink: '/shop',
  productBanners: [
    createProductBanner(),
    createProductBanner(),
    createProductBanner(),
    createProductBanner(),
  ],
  referralRewardCoins: 25
}

export default function PreferencePage() {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(initialState)

  const loadData = async () => {
    try {
      setLoading(true)
      const token = await getToken()

      const prefRes = await axios.get('/api/store/preferences/shop-showcase', { headers: { Authorization: `Bearer ${token}` } })

      const savedShowcase = prefRes.data?.shopShowcase || {}
      const savedProductBanners = Array.isArray(savedShowcase.productBanners) ? savedShowcase.productBanners : []

      setForm({
        ...initialState,
        ...savedShowcase,
        productBanners: Array.from({ length: 4 }, (_, index) => createProductBanner(savedProductBanners[index] || {}))
      })
    } catch (error) {
      toast.error('Failed to load preferences')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const save = async () => {
    try {
      setSaving(true)
      const token = await getToken()
      await axios.put('/api/store/preferences/shop-showcase', form, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success('Preference saved')
    } catch (error) {
      toast.error('Failed to save')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Homepage Showcase Settings</h1>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Banner Settings</h2>
            <p className="text-sm text-slate-600">Banner controls were moved to one dedicated screen so the same settings are not duplicated here.</p>
          </div>
          <Link
            href="/store/customize/showcase-banners"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open Showcase Banner Settings
          </Link>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold">Referral Reward Settings</h2>
        <p className="text-sm text-slate-600">
          When an invited customer places their first order, the inviter receives this wallet amount.
        </p>
        <label className="space-y-1 block max-w-sm">
          <span className="text-sm font-medium text-slate-700">Inviter wallet reward (coins)</span>
          <input
            type="number"
            min={0}
            step={1}
            className="w-full border rounded-lg px-3 py-2"
            value={Number(form.referralRewardCoins || 0)}
            onChange={(e) => {
              const parsed = Number(e.target.value)
              setForm({
                ...form,
                referralRewardCoins: Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
              })
            }}
          />
        </label>
      </div>

      <div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Preference
        </button>
      </div>
    </div>
  )
}
