'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PolicyPageLayout from '@/components/PolicyPageLayout'
import BlogSidebar from '@/components/BlogSidebar'
import { useStorefrontI18n } from '@/lib/useStorefrontI18n'

export default function BlogsPage() {
  const { isArabic } = useStorefrontI18n()
  const [blogs, setBlogs] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('newest')
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          lang: isArabic ? 'ar' : 'en',
          limit: '24',
          sort,
        })
        if (q.trim()) params.set('q', q.trim())
        const res = await fetch(`/api/public/blogs?${params}`)
        const data = await res.json()
        if (cancelled) return
        const list = Array.isArray(data?.blogs) ? data.blogs : []
        setBlogs(list)
        setRecent(list.slice(0, 6))
      } catch {
        if (!cancelled) {
          setBlogs([])
          setRecent([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isArabic, sort, q])

  return (
    <PolicyPageLayout dir={isArabic ? 'rtl' : undefined}>
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">
        {isArabic ? 'المدونة' : 'Blog'}
      </h1>
      <p className="mb-8 max-w-2xl text-[15px] leading-relaxed text-gray-600">
        {isArabic
          ? 'مقالات ونصائح من متجر store1920.'
          : 'Tips, guides, and updates from store1920.'}
      </p>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          className="relative min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            setQ(qInput)
          }}
        >
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-slate-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder={isArabic ? 'ابحث في المقالات…' : 'Search posts…'}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 ps-10 pe-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200/80"
          />
          <button
            type="submit"
            className="absolute inset-y-1 end-1 rounded-lg bg-slate-900 px-4 text-xs font-semibold tracking-wide text-white transition hover:bg-slate-800"
          >
            {isArabic ? 'بحث' : 'Search'}
          </button>
        </form>

        <label className="flex shrink-0 items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
          <span className="hidden sm:inline">{isArabic ? 'ترتيب' : 'Sort'}</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="min-w-[10.5rem] appearance-none rounded-xl border border-slate-200 bg-white py-2.5 ps-4 pe-9 text-sm font-medium normal-case tracking-normal text-slate-800 outline-none transition hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-200/80"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M6 9l6 6 6-6' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: isArabic ? 'left 0.9rem center' : 'right 0.9rem center',
            }}
          >
            <option value="newest">{isArabic ? 'الأحدث أولاً' : 'Newest first'}</option>
            <option value="oldest">{isArabic ? 'الأقدم أولاً' : 'Oldest first'}</option>
            <option value="title">{isArabic ? 'حسب العنوان' : 'Title A–Z'}</option>
          </select>
        </label>
      </div>

      {q.trim() ? (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>
            {isArabic ? 'نتائج البحث عن' : 'Showing results for'}{' '}
            <span className="font-semibold text-slate-900">“{q.trim()}”</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setQ('')
              setQInput('')
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {isArabic ? 'مسح' : 'Clear'}
          </button>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          {loading ? (
            <p className="text-sm text-gray-500">{isArabic ? 'جاري التحميل…' : 'Loading…'}</p>
          ) : blogs.length === 0 ? (
            <div className="rounded-xl border border-gray-200 p-8 text-center text-gray-500">
              {isArabic ? 'لا توجد مقالات بعد.' : 'No blog posts yet.'}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {blogs.map((blog) => (
                <Link
                  key={blog.id}
                  href={`/blogs/${blog.slug}`}
                  className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-sky-300 hover:shadow-sm"
                >
                  {blog.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={blog.coverImage}
                      alt={blog.title}
                      className="aspect-[16/10] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[16/10] items-center justify-center bg-slate-100 text-sm text-slate-400">
                      store1920
                    </div>
                  )}
                  <div className="p-4">
                    <h2 className="text-lg font-semibold text-gray-900 group-hover:text-sky-700">
                      {blog.title}
                    </h2>
                    {blog.excerpt ? (
                      <p className="mt-2 line-clamp-3 text-sm text-gray-600">{blog.excerpt}</p>
                    ) : null}
                    {blog.publishedAt ? (
                      <p className="mt-3 text-xs text-gray-400">
                        {new Date(blog.publishedAt).toLocaleString(isArabic ? 'ar-AE' : 'en-AE')}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <BlogSidebar recentBlogs={recent} isArabic={isArabic} />
        </div>
      </div>
    </PolicyPageLayout>
  )
}
