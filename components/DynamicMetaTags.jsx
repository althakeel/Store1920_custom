"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import axios from "axios"

function normalizePath(path = "/") {
  const raw = String(path || "").trim()
  if (!raw) return "/"
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`
  const withoutQuery = withSlash.split("?")[0].split("#")[0]
  const clean = withoutQuery.replace(/\/{2,}/g, "/").replace(/\/$/, "")
  return clean || "/"
}

function ensureMetaTag(name) {
  let node = document.querySelector(`meta[name=\"${name}\"]`)
  if (!node) {
    node = document.createElement("meta")
    node.setAttribute("name", name)
    document.head.appendChild(node)
  }
  return node
}

export default function DynamicMetaTags() {
  const pathname = usePathname()
  const [seoMap, setSeoMap] = useState({})

  const normalizedPath = useMemo(() => normalizePath(pathname || "/"), [pathname])

  useEffect(() => {
    let active = true

    const loadSeoMap = async () => {
      try {
        const { data } = await axios.get("/api/store/appearance/sections/public", {
          headers: { "Cache-Control": "no-cache" },
          params: { t: Date.now() },
        })

        if (!active) return
        const pageSeo = data?.pageSeo && typeof data.pageSeo === "object" ? data.pageSeo : {}
        setSeoMap(pageSeo)
      } catch {
        if (active) {
          setSeoMap({})
        }
      }
    }

    loadSeoMap()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const current = seoMap?.[normalizedPath]
    if (!current) return

    if (current.title) {
      document.title = current.title
    }

    const descriptionTag = ensureMetaTag("description")
    if (current.description) {
      descriptionTag.setAttribute("content", current.description)
    }

    const keywordsTag = ensureMetaTag("keywords")
    const keywordsValue = Array.isArray(current.keywords) ? current.keywords.join(", ") : ""
    if (keywordsValue) {
      keywordsTag.setAttribute("content", keywordsValue)
    }
  }, [normalizedPath, seoMap])

  return null
}
