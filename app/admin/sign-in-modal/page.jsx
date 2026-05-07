'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/useAuth'
import axios from 'axios'
import Image from 'next/image'
import PageTitle from '@/components/PageTitle'
import { toast } from 'react-hot-toast'
import { UploadCloud, Trash2 } from 'lucide-react'

export default function SignInModalSettingsPage() {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    sideImage: '',
    sideImageLink: '',
    sideImageClickable: false,
    showCtaButton: false,
    ctaButtonText: 'Shop Now',
    ctaButtonLink: '/shop',
  })

  useEffect(() => {
    axios.get('/api/store/signin-modal')
      .then(res => setForm(f => ({ ...f, ...res.data })))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const token = await getToken()
      const fd = new FormData()
      fd.append('image', file)
      const { data } = await axios.post('/api/admin/upload-image', fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      })
      if (data.url) {
        setForm(f => ({ ...f, sideImage: data.url }))
        toast.success('Image uploaded')
      } else {
        toast.error(data.error || 'Upload failed')
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = await getToken()
      await axios.put('/api/store/signin-modal', form, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <PageTitle title="Sign-In Modal Settings" />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Sign-In Modal</h1>
      <p className="text-gray-500 text-sm mb-8">Configure the left-side image panel shown in the login/signup popup.</p>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">

        {/* Side Image Upload */}
        <div className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Left Panel Image</h2>
          <p className="text-xs text-gray-500">When set, the modal becomes 2-column with this image on the left. Leave empty for the original single-column layout.</p>

          {form.sideImage ? (
            <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50" style={{ height: 200 }}>
              <Image src={form.sideImage} alt="Side panel preview" fill style={{ objectFit: 'cover' }} unoptimized />
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, sideImage: '' }))}
                className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1.5 shadow text-red-500 hover:text-red-600 transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
            >
              <UploadCloud size={28} className="text-gray-400" />
              <span className="text-sm text-gray-500">{uploading ? 'Uploading...' : 'Click to upload image'}</span>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />

          {form.sideImage && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-blue-600 hover:underline"
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Replace image'}
            </button>
          )}
        </div>

        {/* Image Clickable */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">Make image clickable</h2>
              <p className="text-xs text-gray-500 mt-0.5">Clicking the image will navigate to the link below and close the modal</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, sideImageClickable: !f.sideImageClickable }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.sideImageClickable ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.sideImageClickable ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {form.sideImageClickable && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Image link URL</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="/shop or https://..."
                value={form.sideImageLink}
                onChange={e => setForm(f => ({ ...f, sideImageLink: e.target.value }))}
              />
            </div>
          )}
        </div>

        {/* CTA Button */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">CTA Button</h2>
              <p className="text-xs text-gray-500 mt-0.5">Show a call-to-action button overlaid on the image</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, showCtaButton: !f.showCtaButton }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.showCtaButton ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.showCtaButton ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {form.showCtaButton && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Button text</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Shop Now"
                  value={form.ctaButtonText}
                  onChange={e => setForm(f => ({ ...f, ctaButtonText: e.target.value }))}
                  maxLength={60}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Button link URL</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="/shop"
                  value={form.ctaButtonLink}
                  onChange={e => setForm(f => ({ ...f, ctaButtonLink: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Preview hint */}
        {!form.sideImage && (
          <div className="px-6 py-4 bg-amber-50 rounded-b-xl">
            <p className="text-xs text-amber-700">No side image set — the modal will use the original single-column layout.</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-gray-900 hover:bg-gray-700 text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
