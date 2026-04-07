'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import Link from 'next/link'
import toast from 'react-hot-toast'


export default function NewHomeSection(){
  const [products, setProducts] = useState([])
  const [sectionType, setSectionType] = useState('manual')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', titleAr: '', subtitle: '', subtitleAr: '', section: '', tag: '', category: '', productIds: [], slides: [], bannerCtaText: '', bannerCtaTextAr: '', bannerCtaLink: '', layout: 'deals_with_banner', isActive: true, sortOrder: 0,
  })

  useEffect(()=>{ (async()=>{
    try{ const { data } = await axios.get('/api/products'); setProducts(data.products || []) }catch(e){ console.error(e) }
  })() },[])

  const pick = (id)=> setForm(f=>({ ...f, productIds: f.productIds.includes(id) ? f.productIds.filter(x=>x!==id) : [...f.productIds, id] }))

  const uploadSlide = async (file) => {
    const fd = new FormData(); fd.append('image', file)
    try{ const { data } = await axios.post('/api/store/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = data?.url || data?.imageUrl; if(url) setForm(f=>({ ...f, slides:[...f.slides, url] }))
    }catch(e){ toast.error('Upload failed') }
  }

  const toSectionKey = (str)=>
    (str||'')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g,'_')
      .replace(/^_+|_+$/g,'');

  const submit = async (e)=>{
    e.preventDefault(); setSaving(true)
    try{
      // Auto-generate section key from title if missing
      const payload = {
        ...form,
        sectionType,
        category: sectionType === 'category' ? form.category : '',
        productIds: sectionType === 'manual' ? form.productIds : [],
      };
      if(!payload.section){
        payload.section = toSectionKey(payload.title);
      }
      await axios.post('/api/admin/home-sections', payload);
      toast.success('Section created');
      window.location.href='/admin/home-sections'
    }catch(e){
      toast.error(e?.response?.data?.error || 'Failed to create')
    }finally{ setSaving(false) }
  }

  const categories = [...new Set(products.map(p=>p.category))]

  return (
    <div className='max-w-6xl mx-auto p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold'>Add Homepage Section</h1>
        <Link href='/admin/home-sections' className='text-sm text-blue-600'>Back to list</Link>
      </div>

      <form onSubmit={submit} className='bg-white border rounded-xl shadow p-6 space-y-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm text-gray-600'>Title</label>
            <input className='w-full border rounded-lg px-3 py-2' value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/>
          </div>
          <div>
            <label className='block text-sm text-gray-600'>Title (Arabic)</label>
            <input className='w-full border rounded-lg px-3 py-2' value={form.titleAr} onChange={e=>setForm({...form,titleAr:e.target.value})} dir='rtl' placeholder='عنوان القسم بالعربية'/>
          </div>
          <div>
            <label className='block text-sm text-gray-600'>Section Key</label>
            <input className='w-full border rounded-lg px-3 py-2' value={form.section} onChange={e=>setForm({...form,section:e.target.value})} placeholder="e.g., limited_offers" required/>
          </div>
        </div>
        <div>
          <label className='block text-sm text-gray-600'>Subtitle</label>
          <input className='w-full border rounded-lg px-3 py-2' value={form.subtitle} onChange={e=>setForm({...form,subtitle:e.target.value})}/>
        </div>
        <div>
          <label className='block text-sm text-gray-600'>Subtitle (Arabic)</label>
          <input className='w-full border rounded-lg px-3 py-2' value={form.subtitleAr} onChange={e=>setForm({...form,subtitleAr:e.target.value})} dir='rtl' placeholder='العنوان الفرعي بالعربية'/>
        </div>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div>
            <label className='block text-sm text-gray-600'>Section Type</label>
            <select className='w-full border rounded-lg px-3 py-2' value={sectionType} onChange={e=>setSectionType(e.target.value)}>
              <option value='manual'>Manual</option>
              <option value='category'>By Category</option>
              <option value='hero_categories'>Hero Categories Slider</option>
            </select>
          </div>
          <div>
            <label className='block text-sm text-gray-600'>Tag</label>
            <input className='w-full border rounded-lg px-3 py-2' value={form.tag} onChange={e=>setForm({...form,tag:e.target.value})} placeholder='e.g., Summer Sale'/>
          </div>
          <div>
            <label className='block text-sm text-gray-600'>Sort Order</label>
            <input type='number' className='w-full border rounded-lg px-3 py-2' value={form.sortOrder} onChange={e=>setForm({...form,sortOrder:Number(e.target.value)})}/>
          </div>
        </div>
        {sectionType==='category' && (
          <div>
            <label className='block text-sm text-gray-600'>Category</label>
            <select className='w-full border rounded-lg px-3 py-2' value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
              <option value=''>Select</option>
              {categories.map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {sectionType==='hero_categories' && (
          <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
            This section enables the icon-based categories strip directly below the hero slider on the homepage. Manage the category items from Storefront Home Menu Categories.
          </div>
        )}

        {sectionType==='manual' && (
          <div>
            <label className='block text-sm text-gray-600'>Products ({form.productIds.length} selected)</label>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3 border rounded-lg p-3 max-h-96 overflow-auto'>
              {products.map(p=> (
                <button type='button' key={p._id} onClick={()=>pick(p._id)} className={`text-left border-2 rounded-lg p-3 ${form.productIds.includes(p._id)?'border-blue-600 bg-blue-50':'border-gray-200'}`}>
                  <img src={p.images[0]} alt={p.name} className='w-full aspect-square object-contain mb-2'/>
                  <div className='text-xs font-medium'>{p.name}</div>
                  <div className='text-xs text-gray-600'>AED {p.price}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className='space-y-2'>
          <label className='block text-sm text-gray-600'>Banner Slides</label>
          {form.slides.length>0 && (
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
              {form.slides.map((u,i)=> (
                <div key={i} className='relative group border rounded-lg overflow-hidden'>
                  <img src={u} className='w-full aspect-video object-cover'/>
                  <button type='button' onClick={()=>setForm(f=>({...f,slides:f.slides.filter((_,x)=>x!==i)}))} className='absolute top-1 right-1 text-xs bg-black/60 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100'>Remove</button>
                </div>
              ))}
            </div>
          )}
          <input type='file' accept='image/*' onChange={e=> e.target.files && uploadSlide(e.target.files[0])}/>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div>
            <label className='block text-sm text-gray-600'>CTA Text</label>
            <input className='w-full border rounded-lg px-3 py-2' value={form.bannerCtaText} onChange={e=>setForm({...form,bannerCtaText:e.target.value})}/>
          </div>
          <div>
            <label className='block text-sm text-gray-600'>CTA Text (Arabic)</label>
            <input className='w-full border rounded-lg px-3 py-2' value={form.bannerCtaTextAr} onChange={e=>setForm({...form,bannerCtaTextAr:e.target.value})} dir='rtl' placeholder='نص الزر بالعربية'/>
          </div>
          <div>
            <label className='block text-sm text-gray-600'>CTA Link</label>
            <input className='w-full border rounded-lg px-3 py-2' value={form.bannerCtaLink} onChange={e=>setForm({...form,bannerCtaLink:e.target.value})} placeholder='/shop'/>
          </div>
          <label className='flex items-center gap-2'><input type='checkbox' checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})}/> Active</label>
        </div>

        <div className='flex items-center gap-3 justify-end'>
          <Link href='/admin/home-sections' className='px-4 py-2 border rounded-lg'>Cancel</Link>
          <button disabled={saving} className='px-4 py-2 bg-black text-white rounded-lg'>{saving?'Saving...':'Create Section'}</button>
        </div>
      </form>
    </div>
  )
}
