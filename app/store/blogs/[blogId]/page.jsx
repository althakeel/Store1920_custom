'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2, Save, Upload } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import BlogRichTextEditor from '@/components/store/BlogRichTextEditor'
import { compressImageForUpload } from '@/lib/compressImageForUpload'
import { slugifyBlogTitle } from '@/lib/blogHelpers'

const emptyForm = {
  title: '',
  titleAr: '',
  slug: '',
  excerpt: '',
  excerptAr: '',
  contentHtml: '',
  contentHtmlAr: '',
  coverImage: '',
  status: 'draft',
  publishedAt: '',
  seoTitle: '',
  seoDescription: '',
  authorName: '',
}

function toDatetimeLocalValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDatetimeLocalValue(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export default function StoreBlogEditorPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const params = useParams()
  const blogId = params?.blogId && params.blogId !== 'new' ? String(params.blogId) : null
  const isNew = !blogId

  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [slugManual, setSlugManual] = useState(false)
  const [langTab, setLangTab] = useState('en')

  const load = useCallback(async () => {
    if (!blogId) return
    try {
      setLoading(true)
      const token = await getToken()
      const { data } = await axios.get(`/api/store/blogs/${blogId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blog = data?.blog || {}
      setForm({
        ...emptyForm,
        ...blog,
        publishedAt: toDatetimeLocalValue(blog.publishedAt) || toDatetimeLocalValue(new Date()),
      })
      setSlugManual(Boolean(blog.slug))
    } catch (error) {
      console.error(error)
      toast.error(error?.response?.data?.error || 'Failed to load blog')
      router.push('/store/blogs')
    } finally {
      setLoading(false)
    }
  }, [blogId, getToken, router])

  useEffect(() => {
    load()
  }, [load])

  const patch = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'title' && !slugManual) {
        next.slug = slugifyBlogTitle(value)
      }
      return next
    })
  }

  const uploadCover = async (file) => {
    if (!file) return
    try {
      setUploadingCover(true)
      const token = await getToken()
      const compressed = await compressImageForUpload(file, {
        maxBytes: 4 * 1024 * 1024,
        preserveTransparency: true,
      })
      const body = new FormData()
      body.append('image', compressed)
      body.append('type', 'blog')
      const response = await fetch('/api/store/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Upload failed')
      patch('coverImage', data.url)
      toast.success('Cover uploaded to S3')
    } catch (error) {
      console.error(error)
      toast.error(error?.message || 'Cover upload failed')
    } finally {
      setUploadingCover(false)
    }
  }

  const save = async () => {
    if (!String(form.title || '').trim()) {
      toast.error('Title is required')
      return
    }
    try {
      setSaving(true)
      const token = await getToken()
      const payload = {
        ...form,
        slug: form.slug || slugifyBlogTitle(form.title),
        publishedAt: fromDatetimeLocalValue(form.publishedAt),
      }
      if (isNew) {
        const { data } = await axios.post('/api/store/blogs', payload, {
          headers: { Authorization: `Bearer ${token}` },
        })
        toast.success('Blog created')
        router.replace(`/store/blogs/${data.blog.id}`)
      } else {
        await axios.put(`/api/store/blogs/${blogId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        })
        toast.success('Blog saved')
        await load()
      }
    } catch (error) {
      console.error(error)
      toast.error(error?.response?.data?.error || 'Failed to save blog')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/store/blogs"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft size={16} />
            Blogs
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            {isNew ? 'New blog post' : 'Edit blog post'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Rich description supports H1–H3, fonts, colors, and S3 images you can drag inside the body.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
            Title (English)
            <input
              type="text"
              value={form.title}
              onChange={(e) => patch('title', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2" dir="rtl">
            Title (Arabic)
            <input
              type="text"
              value={form.titleAr}
              onChange={(e) => patch('titleAr', e.target.value)}
              dir="rtl"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Slug
            <input
              type="text"
              value={form.slug}
              onChange={(e) => {
                setSlugManual(true)
                patch('slug', slugifyBlogTitle(e.target.value))
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Status
            <select
              value={form.status}
              onChange={(e) => patch('status', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Publish date & time
            <input
              type="datetime-local"
              value={form.publishedAt || ''}
              onChange={(e) => patch('publishedAt', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
            <span className="mt-1 block text-[11px] font-normal text-slate-400">
              Frontend lists newest publish date first. Future dates stay hidden until that time.
            </span>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Author name
            <input
              type="text"
              value={form.authorName}
              onChange={(e) => patch('authorName', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {form.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.coverImage} alt="Cover" className="aspect-[16/10] w-full object-cover" />
            ) : (
              <div className="flex aspect-[16/10] items-center justify-center text-xs text-slate-400">
                Cover image
              </div>
            )}
            <label className="flex cursor-pointer items-center justify-center gap-2 border-t border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50">
              {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload size={14} />}
              Upload cover (S3)
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingCover}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) uploadCover(file)
                }}
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-600">
            Cover image URL
            <input
              type="url"
              value={form.coverImage}
              onChange={(e) => patch('coverImage', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              placeholder="https://..."
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLangTab('en')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              langTab === 'en' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            English content
          </button>
          <button
            type="button"
            onClick={() => setLangTab('ar')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              langTab === 'ar' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Arabic content
          </button>
        </div>

        {langTab === 'en' ? (
          <>
            <label className="block text-xs font-medium text-slate-600">
              Excerpt (English)
              <textarea
                value={form.excerpt}
                onChange={(e) => patch('excerpt', e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">Description (English)</p>
              <BlogRichTextEditor
                value={form.contentHtml}
                onChange={(html) => patch('contentHtml', html)}
                getToken={getToken}
                dir="ltr"
              />
            </div>
          </>
        ) : (
          <>
            <label className="block text-xs font-medium text-slate-600" dir="rtl">
              Excerpt (Arabic)
              <textarea
                value={form.excerptAr}
                onChange={(e) => patch('excerptAr', e.target.value)}
                rows={2}
                dir="rtl"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">Description (Arabic)</p>
              <BlogRichTextEditor
                value={form.contentHtmlAr}
                onChange={(html) => patch('contentHtmlAr', html)}
                getToken={getToken}
                dir="rtl"
              />
            </div>
          </>
        )}
      </section>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
          SEO title
          <input
            type="text"
            value={form.seoTitle}
            onChange={(e) => patch('seoTitle', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
          SEO description
          <textarea
            value={form.seoDescription}
            onChange={(e) => patch('seoDescription', e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
      </section>
    </div>
  )
}
