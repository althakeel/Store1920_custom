'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
    Eye,
    LayoutList,
    Loader2,
    Menu,
    PanelsTopLeft,
    Save,
    Search,
    Sparkles,
} from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import PageSkeleton from '@/components/PageSkeleton'
import NavbarPreview from '@/components/store/NavbarPreview'

const POSITION_OPTIONS = [
    { id: 'top', label: 'Top', description: 'Standard top bar' },
    { id: 'sticky', label: 'Sticky', description: 'Stays visible while scrolling' },
    { id: 'bottom', label: 'Bottom', description: 'Fixed at page bottom' },
]

const STYLE_OPTIONS = [
    { id: 'horizontal', label: 'Horizontal', description: 'Links in a row' },
    { id: 'vertical', label: 'Vertical', description: 'Stacked menu links' },
    { id: 'minimal', label: 'Minimal', description: 'Compact clean layout' },
]

function ToggleRow({ title, description, checked, onChange }) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div>
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="text-xs text-slate-500">{description}</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onChange(event.target.checked)}
                    className="peer sr-only"
                />
                <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-sky-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
            </label>
        </div>
    )
}

export default function NavbarMenuPage() {
    const { getToken, user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [enabled, setEnabled] = useState(true)
    const [position, setPosition] = useState('top')
    const [style, setStyle] = useState('horizontal')
    const [previewBranding, setPreviewBranding] = useState({
        logoUrl: '',
        logoWidth: 50,
        logoHeight: 50,
        backgroundColor: '#9f4b1d',
    })
    const [previewMenu, setPreviewMenu] = useState({
        navMenuEnabled: true,
        navMenuItems: [],
        navActionsVisibility: { wishlist: true, cart: true, orders: true },
    })

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                const token = await getToken()
                const headers = { Authorization: `Bearer ${token}` }
                const [appearanceRes, brandingRes, settingsRes] = await Promise.all([
                    axios.get('/api/store/appearance/sections', { headers }),
                    axios.get('/api/store/navbar-menu', { headers }),
                    axios.get('/api/store/settings', { headers }),
                ])
                const navbar = appearanceRes.data?.navbarMenu || {}
                setEnabled(typeof navbar.enabled === 'boolean' ? navbar.enabled : true)
                setPosition(['top', 'bottom', 'sticky'].includes(navbar.position) ? navbar.position : 'top')
                setStyle(['horizontal', 'vertical', 'minimal'].includes(navbar.style) ? navbar.style : 'horizontal')

                const branding = brandingRes.data || {}
                setPreviewBranding({
                    logoUrl: branding.logoUrl || '',
                    logoWidth: branding.logoWidth || 50,
                    logoHeight: branding.logoHeight || 50,
                    backgroundColor: branding.backgroundColor || '#9f4b1d',
                })

                const settings = settingsRes.data || {}
                setPreviewMenu({
                    navMenuEnabled: Boolean(settings.navMenuEnabled),
                    navMenuItems: Array.isArray(settings.navMenuItems) ? settings.navMenuItems : [],
                    navActionsVisibility: {
                        orders: settings?.navActionsVisibility?.orders !== false,
                        wishlist: settings?.navActionsVisibility?.wishlist !== false,
                        cart: settings?.navActionsVisibility?.cart !== false,
                    },
                })
            } catch (error) {
                toast.error('Failed to load navbar settings')
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [getToken])

    const handleSave = async (event) => {
        event.preventDefault()
        setSaving(true)
        try {
            const token = await getToken()
            await axios.post('/api/store/appearance/sections', {
                navbarMenu: {
                    enabled,
                    position,
                    style,
                },
            }, {
                headers: { Authorization: `Bearer ${token}` },
            })
            toast.success('Navbar settings saved')
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <PageSkeleton />
    }

    return (
        <form
            onSubmit={handleSave}
            className="-mx-3 -mt-3 min-h-full w-full max-w-full overflow-x-hidden bg-white pb-16 sm:-mx-4 sm:-mt-4 lg:-mx-5 lg:-mt-5"
        >
            <div className="border-b border-slate-200 bg-white">
                <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-6">
                    <div>
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                            <Sparkles size={14} />
                            Navigation
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                            Navbar Menu
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Configure navigation bar appearance and behavior on the storefront.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href="/store/navbar-menu"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            <LayoutList size={16} />
                            Menu items
                        </Link>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save changes
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
                <div className="space-y-5">
                    <div className="overflow-visible rounded-2xl border border-slate-200 bg-white">
                        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">
                            <Eye size={14} />
                            Live preview
                        </div>
                        <div className="overflow-visible p-4 sm:p-5">
                            {enabled ? (
                                <>
                                    <NavbarPreview
                                        backgroundColor={previewBranding.backgroundColor}
                                        logoUrl={previewBranding.logoUrl}
                                        logoWidth={previewBranding.logoWidth}
                                        logoHeight={previewBranding.logoHeight}
                                        navMenuEnabled={previewMenu.navMenuEnabled}
                                        navMenuItems={previewMenu.navMenuItems}
                                        navActionsVisibility={previewMenu.navActionsVisibility}
                                        userName={user?.displayName || user?.email?.split('@')[0] || 'store1920'}
                                        searchPlaceholder="Coffee Maker"
                                    />
                                    <p className="mt-3 text-[11px] text-slate-500">
                                        {position} · {style}
                                    </p>
                                </>
                            ) : (
                                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
                                    Navbar hidden on storefront
                                </div>
                            )}
                        </div>
                    </div>

                    <ToggleRow
                        title="Enable navbar"
                        description="Show navigation bar on all pages"
                        checked={enabled}
                        onChange={setEnabled}
                    />

                    {enabled ? (
                        <>
                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                                    <h2 className="mb-4 text-sm font-semibold text-slate-900">Position</h2>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        {POSITION_OPTIONS.map((option) => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setPosition(option.id)}
                                                className={`rounded-xl border p-3 text-left transition ${
                                                    position === option.id
                                                        ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-200'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                                                <p className="mt-0.5 text-[11px] text-slate-500">{option.description}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                                    <h2 className="mb-4 text-sm font-semibold text-slate-900">Menu style</h2>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        {STYLE_OPTIONS.map((option) => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setStyle(option.id)}
                                                className={`rounded-xl border p-3 text-left transition ${
                                                    style === option.id
                                                        ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-200'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                                                <p className="mt-0.5 text-[11px] text-slate-500">{option.description}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                                <Search size={16} className="mb-2 inline text-slate-400" />
                                Search bar and category links are controlled from{' '}
                                <Link href="/store/navbar-menu" className="font-semibold text-sky-700 hover:underline">
                                    Menu Management
                                </Link>
                                .
                            </div>
                        </>
                    ) : (
                        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                            <PanelsTopLeft size={32} className="text-slate-300" />
                            <p className="mt-3 text-sm font-medium text-slate-700">Navbar is disabled</p>
                            <p className="mt-1 text-xs text-slate-500">Turn it on to configure position and style.</p>
                        </div>
                    )}
                </div>
            </div>
        </form>
    )
}
