"use client"

import { useMemo, useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "@/lib/useAuth"

const PRESET_PAGES = [
  { label: "Home", path: "/" },
  { label: "Shop", path: "/shop" },
  { label: "Fast Delivery", path: "/fast-delivery" },
  { label: "Wishlist", path: "/wishlist" },
  { label: "Cart", path: "/cart" },
  { label: "Checkout", path: "/checkout" },
  { label: "Track Order", path: "/track-order" },
  { label: "Contact", path: "/contact" },
  { label: "About", path: "/about" },
]

function normalizePath(path = "/") {
  const raw = String(path || "").trim()
  if (!raw) return "/"
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`
  const withoutQuery = withSlash.split("?")[0].split("#")[0]
  const clean = withoutQuery.replace(/\/{2,}/g, "/").replace(/\/$/, "")
  return clean || "/"
}

function parseKeywords(input = "") {
  return Array.from(
    new Set(
      String(input || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

export default function StorefrontSeoPage() {
  const { getToken } = useAuth()

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [customPath, setCustomPath] = useState("")
  const [selectedPath, setSelectedPath] = useState("/")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [keywordsInput, setKeywordsInput] = useState("")
  const [pageSeoMap, setPageSeoMap] = useState({})

  const allPathOptions = useMemo(() => {
    const preset = PRESET_PAGES.map((page) => page.path)
    const dynamic = Object.keys(pageSeoMap || {})
    return Array.from(new Set([...preset, ...dynamic])).sort((a, b) => a.localeCompare(b))
  }, [pageSeoMap])

  const hydrateFormForPath = (path, map = pageSeoMap) => {
    const key = normalizePath(path)
    const current = map?.[key] || {}
    setSelectedPath(key)
    setTitle(current.title || "")
    setDescription(current.description || "")
    setKeywordsInput(Array.isArray(current.keywords) ? current.keywords.join(", ") : "")
  }

  const loadSettings = async () => {
    setLoading(true)
    setMessage("")
    try {
      const token = await getToken()
      const { data } = await axios.get("/api/store/appearance/sections", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const nextMap = data?.pageSeo && typeof data.pageSeo === "object" ? data.pageSeo : {}
      setPageSeoMap(nextMap)
      hydrateFormForPath(selectedPath, nextMap)
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to load SEO settings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handlePathSelect = (value) => {
    const normalized = normalizePath(value)
    hydrateFormForPath(normalized)
    setMessage("")
  }

  const handleUseCustomPath = () => {
    const normalized = normalizePath(customPath)
    handlePathSelect(normalized)
    setCustomPath("")
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage("")

    const key = normalizePath(selectedPath)
    const nextKeywords = parseKeywords(keywordsInput)

    const nextMap = {
      ...(pageSeoMap || {}),
      [key]: {
        title: title.trim(),
        description: description.trim(),
        keywords: nextKeywords,
      },
    }

    if (!title.trim() && !description.trim() && nextKeywords.length === 0) {
      delete nextMap[key]
    }

    try {
      const token = await getToken()
      await axios.post(
        "/api/store/appearance/sections",
        { pageSeo: nextMap },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setPageSeoMap(nextMap)
      setMessage("SEO settings saved successfully")
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to save SEO settings")
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    const key = normalizePath(selectedPath)
    const nextMap = { ...(pageSeoMap || {}) }
    delete nextMap[key]

    try {
      setSaving(true)
      setMessage("")
      const token = await getToken()
      await axios.post(
        "/api/store/appearance/sections",
        { pageSeo: nextMap },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setPageSeoMap(nextMap)
      setTitle("")
      setDescription("")
      setKeywordsInput("")
      setMessage("SEO settings removed for this page")
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to remove SEO settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Page SEO Meta Tags</h1>
        <p className="mt-2 text-sm text-slate-600">
          Select a page path and configure meta title, description, and keywords.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading settings...</p>
        ) : (
          <form onSubmit={handleSave} className="mt-6 space-y-5">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Select page</label>
                <select
                  value={selectedPath}
                  onChange={(e) => handlePathSelect(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {allPathOptions.map((path) => (
                    <option key={path} value={path}>
                      {path}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Custom page path</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    placeholder="/your-page"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleUseCustomPath}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white"
                  >
                    Use
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Meta title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Enter page meta title"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Meta description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={320}
                rows={4}
                placeholder="Enter page meta description"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Meta keywords</label>
              <input
                type="text"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                placeholder="keyword1, keyword2, keyword3"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Separate keywords using commas.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save SEO"}
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={saving}
                className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
              >
                Remove For This Page
              </button>
              <button
                type="button"
                onClick={loadSettings}
                disabled={saving}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            {message && (
              <p className={`text-sm ${message.toLowerCase().includes("success") ? "text-emerald-700" : "text-slate-700"}`}>
                {message}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
