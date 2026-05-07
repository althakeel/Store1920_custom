'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, updateProfile } from 'firebase/auth'
import axios from 'axios'
import Loading from '@/components/Loading'
import Link from 'next/link'
import toast from 'react-hot-toast'
import AddressModal from '@/components/AddressModal'
import DashboardSidebar from '@/components/DashboardSidebar'

export default function DashboardProfilePage() {
  const [user, setUser] = useState(undefined)
  const [dbPhone, setDbPhone] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [referredByUserId, setReferredByUserId] = useState(null)
  const [referralRewardCreditedAt, setReferralRewardCreditedAt] = useState(null)
  const [referralCodeInput, setReferralCodeInput] = useState('')
  const [loadingReferralCode, setLoadingReferralCode] = useState(false)
  const [claimingReferralCode, setClaimingReferralCode] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const [isEditing, setIsEditing] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [addrLoading, setAddrLoading] = useState(false)
  const [showAddrModal, setShowAddrModal] = useState(false)
  const [addrToEdit, setAddrToEdit] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null))
    return () => unsub()
  }, [])

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return
      try {
        const token = await auth.currentUser.getIdToken(true)
        const { data } = await axios.get('/api/profile', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setDbPhone(data?.profile?.phone || '')
        setReferredByUserId(data?.profile?.referredByUserId || null)
        setReferralRewardCreditedAt(data?.profile?.referralRewardCreditedAt || null)
      } catch {
        setDbPhone('')
        setReferredByUserId(null)
        setReferralRewardCreditedAt(null)
      }
    }
    loadProfile()
  }, [user])

  useEffect(() => {
    const loadReferralCode = async () => {
      if (!user) return
      try {
        setLoadingReferralCode(true)
        const token = await auth.currentUser.getIdToken(true)
        const { data } = await axios.get('/api/referral/my-code', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setReferralCode((data?.referralCode || '').toString())
      } catch (error) {
        console.error('[PROFILE] referral code error:', error?.response?.data || error.message)
        setReferralCode('')
      } finally {
        setLoadingReferralCode(false)
      }
    }

    loadReferralCode()
  }, [user])

  // load saved addresses for the user
  useEffect(() => {
    const loadAddresses = async () => {
      if (!user) return
      try {
        setAddrLoading(true)
        const token = await auth.currentUser.getIdToken(true)
        // Fetch addresses from the correct endpoint
        const { data } = await axios.get('/api/address', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const list = Array.isArray(data?.addresses) ? data.addresses : (Array.isArray(data) ? data : [])
        setAddresses(list)
      } catch (err) {
        console.error('[PROFILE] addresses error:', err?.response?.data || err.message)
      } finally {
        setAddrLoading(false)
      }
    }
    loadAddresses()
  }, [user])

  if (user === undefined) return <Loading />

  if (user === null) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-800 mb-3">Dashboard / Profile</h1>
        <p className="text-slate-600 mb-6">You need to sign in to view your profile.</p>
        <Link href="/" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg">Go to Home</Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-4 gap-6">
        <DashboardSidebar />

        <main className="md:col-span-3">
          {activeTab === 'profile' && (
            <>
              <h1 className="text-2xl font-semibold text-slate-800 mb-6">Your Profile</h1>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex items-center gap-6">
                {user.photoURL ? (
                  <Image src={user.photoURL} alt="Profile photo" width={80} height={80} className="rounded-full object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold">
                    {(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-900 text-lg font-medium">{user.displayName || 'No name set'}</p>
                    <button onClick={() => setIsEditing((v) => !v)} className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg">
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                  </div>
                  <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="text-slate-600">
                      <span className="font-medium text-slate-700">Email: </span>{user.email || '—'}
                    </div>
                    <div className="text-slate-600">
                      <span className="font-medium text-slate-700">Phone: </span>{dbPhone || user.phoneNumber || '—'}
                    </div>
                    <div className="text-slate-600">
                      <span className="font-medium text-slate-700">Account Created: </span>{new Date(user.metadata?.creationTime || Date.now()).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Invite & Earn</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Share your referral code. When your invited customer places their first order, you earn wallet reward.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-lg p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Your Referral Code</p>
                    {loadingReferralCode ? (
                      <p className="text-sm text-slate-500">Generating...</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-sm text-slate-900 break-all">
                            {referralCode || 'Not available'}
                          </div>
                          <button
                            type="button"
                            disabled={!referralCode}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(referralCode)
                                toast.success('Referral code copied')
                              } catch {
                                toast.error('Could not copy code')
                              }
                            }}
                            className="px-3 py-2 text-sm bg-slate-800 text-white rounded-lg disabled:opacity-50"
                          >
                            Copy
                          </button>
                        </div>
                        {referralCode && (
                          <div>
                            <p className="text-xs text-slate-500 mb-2">Share via</p>
                            <div className="flex flex-wrap gap-2">
                              {/* WhatsApp */}
                              <button
                                type="button"
                                onClick={() => {
                                  const link = `${window.location.origin}/?ref=${referralCode}`
                                  const text = `Join and shop with my referral code ${referralCode}! ${link}`
                                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
                                style={{ backgroundColor: '#25D366' }}
                              >
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                                WhatsApp
                              </button>
                              {/* Telegram */}
                              <button
                                type="button"
                                onClick={() => {
                                  const link = `${window.location.origin}/?ref=${referralCode}`
                                  const text = `Join and shop with my referral code ${referralCode}!`
                                  window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, '_blank')
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
                                style={{ backgroundColor: '#229ED9' }}
                              >
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                                Telegram
                              </button>
                              {/* Twitter / X */}
                              <button
                                type="button"
                                onClick={() => {
                                  const link = `${window.location.origin}/?ref=${referralCode}`
                                  const text = `Join and shop with my referral code ${referralCode}! ${link}`
                                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-black"
                              >
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.848L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                                X (Twitter)
                              </button>
                              {/* Facebook */}
                              <button
                                type="button"
                                onClick={() => {
                                  const link = `${window.location.origin}/?ref=${referralCode}`
                                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, '_blank')
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
                                style={{ backgroundColor: '#1877F2' }}
                              >
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                Facebook
                              </button>
                              {/* Copy Link */}
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const link = `${window.location.origin}/?ref=${referralCode}`
                                    await navigator.clipboard.writeText(link)
                                    toast.success('Referral link copied')
                                  } catch {
                                    toast.error('Could not copy link')
                                  }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg"
                              >
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                Copy Link
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-lg p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Apply Referral Code</p>
                    <form
                      className="flex items-center gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault()
                        const code = referralCodeInput.trim().toUpperCase()
                        if (!code) {
                          toast.error('Please enter referral code')
                          return
                        }

                        try {
                          setClaimingReferralCode(true)
                          const token = await auth.currentUser.getIdToken(true)
                          const { data } = await axios.post(
                            '/api/referral/claim',
                            { referralCode: code },
                            { headers: { Authorization: `Bearer ${token}` } }
                          )
                          setReferredByUserId(data?.referredByUserId || 'linked')
                          setReferralCodeInput('')
                          toast.success(data?.message || 'Referral code applied')
                        } catch (error) {
                          toast.error(error?.response?.data?.error || 'Failed to apply referral code')
                        } finally {
                          setClaimingReferralCode(false)
                        }
                      }}
                    >
                      <input
                        value={referralCodeInput}
                        onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                        placeholder="Enter referral code"
                        disabled={!!referredByUserId || claimingReferralCode}
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
                      />
                      <button
                        type="submit"
                        disabled={!!referredByUserId || claimingReferralCode}
                        className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50"
                      >
                        {claimingReferralCode ? 'Applying...' : 'Apply'}
                      </button>
                    </form>
                    <p className="text-xs mt-2 text-slate-600">
                      {referredByUserId
                        ? 'Referral code already linked to this account.'
                        : 'You can apply referral code only before your first purchase.'}
                    </p>
                    {referralRewardCreditedAt ? (
                      <p className="text-xs mt-1 text-emerald-700">
                        Inviter reward credited on: {new Date(referralRewardCreditedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 items-start">
                {/* Edit-only section */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                  <h2 className="text-lg font-semibold text-slate-800 mb-2">Edit Profile</h2>
                  <p className="text-slate-600 mb-2 text-xs">Only editable fields appear below.</p>
                  <p className="text-slate-600 mb-3 text-xs">Click "Edit" above to modify your name or photo.</p>
                  {isEditing && (
                    <form
                      className="flex flex-col gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault()
                        const formData = new FormData(e.currentTarget)
                        const displayName = formData.get('displayName')?.toString() || ''
                        const phone = formData.get('phone')?.toString().trim() || ''
                        const photoURL = formData.get('photoURL')?.toString() || user.photoURL || ''
                        try {
                          await updateProfile(auth.currentUser, { displayName, photoURL })
                          const token = await auth.currentUser.getIdToken(true)
                          await axios.patch('/api/profile', {
                            name: displayName,
                            phone,
                            image: photoURL,
                            email: user.email || '',
                          }, {
                            headers: { Authorization: `Bearer ${token}` },
                          })
                          toast.success('Profile updated')
                          setUser({ ...user, displayName, photoURL })
                          setDbPhone(phone)
                          setIsEditing(false)
                        } catch (err) {
                          toast.error(err?.message || 'Failed to update profile')
                        }
                      }}
                    >
                      <label className="text-xs text-slate-700 font-medium">Display Name</label>
                      <input
                        name="displayName"
                        defaultValue={user.displayName || ''}
                        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="Your name"
                      />
                      <label className="text-xs text-slate-700 font-medium mt-1">Phone</label>
                      <input
                        name="phone"
                        defaultValue={dbPhone || user.phoneNumber || ''}
                        maxLength={15}
                        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="Enter phone number"
                      />
                      <label className="text-xs text-slate-700 font-medium mt-1">Profile Photo</label>
                      <div className="flex items-center gap-3">
                        {user.photoURL && (
                          <Image src={user.photoURL} alt="Current photo" width={50} height={50} className="rounded-full object-cover" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error('Image must be less than 5MB')
                              return
                            }
                            
                            setUploading(true)
                            try {
                              const token = await auth.currentUser.getIdToken()
                              const formData = new FormData()
                              formData.append('file', file)
                              formData.append('folder', 'profile-photos')
                              
                              const { data } = await axios.post('/api/imagekit-auth/upload', formData, {
                                headers: { 
                                  Authorization: `Bearer ${token}`,
                                  'Content-Type': 'multipart/form-data'
                                }
                              })
                              
                              if (data.url) {
                                await updateProfile(auth.currentUser, { photoURL: data.url })
                                const latestPhone = (document.querySelector('input[name="phone"]')?.value || dbPhone || '').trim()
                                const token2 = await auth.currentUser.getIdToken(true)
                                await axios.patch('/api/profile', {
                                  name: user.displayName || '',
                                  phone: latestPhone,
                                  image: data.url,
                                  email: user.email || '',
                                }, {
                                  headers: { Authorization: `Bearer ${token2}` },
                                })
                                setUser({ ...user, photoURL: data.url })
                                toast.success('Photo uploaded successfully')
                              }
                            } catch (err) {
                              toast.error(err?.response?.data?.error || 'Failed to upload photo')
                            } finally {
                              setUploading(false)
                            }
                          }}
                          disabled={uploading}
                          className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer disabled:opacity-50"
                        />
                      </div>
                      {uploading && <p className="text-xs text-blue-600">Uploading...</p>}
                      {user.photoURL && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await updateProfile(auth.currentUser, { photoURL: '' })
                              const token = await auth.currentUser.getIdToken(true)
                              await axios.patch('/api/profile', {
                                name: user.displayName || '',
                                phone: dbPhone || '',
                                image: '',
                                email: user.email || '',
                              }, {
                                headers: { Authorization: `Bearer ${token}` },
                              })
                              setUser({ ...user, photoURL: '' })
                              toast.success('Profile photo removed')
                            } catch (err) {
                              toast.error(err?.response?.data?.error || 'Failed to remove photo')
                            }
                          }}
                          className="w-fit text-xs px-3 py-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                        >
                          Remove Photo
                        </button>
                      )}
                      <input type="hidden" name="photoURL" value={user.photoURL || ''} />
                      <div className="flex gap-2 mt-2">
                        <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
                        <button type="button" onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-sm bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300">Cancel</button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Saved addresses */}
                <div id="addresses" className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-slate-800">Saved Addresses</h2>
                    <button onClick={() => { setAddrToEdit(null); setShowAddrModal(true) }} className="text-xs text-blue-600 hover:underline font-medium">Add New</button>
                  </div>
                  {addrLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-7 h-7 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
                    </div>
                  ) : addresses.length === 0 ? (
                    <div className="flex items-center justify-center py-4">
                      <p className="text-slate-500 text-center text-sm">No saved addresses yet.<br/><span className="text-xs">Click "Add New" to create one.</span></p>
                    </div>
                  ) : (
                    <ul className="space-y-2 overflow-y-auto max-h-96">
                      {addresses.map((a) => (
                        <li key={a.id || a._id} className="border border-slate-200 rounded-lg p-3 text-xs text-slate-700 hover:border-slate-300 transition">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-semibold text-slate-900 mb-0.5">{a.name || a.fullName || 'Address'}</div>
                              <div className="text-slate-600 text-xs">{[a.street, a.city, a.state, a.zip]?.filter(Boolean).join(', ')}</div>
                              <div className="text-slate-500 text-xs mt-0.5">{a.country || 'India'}</div>
                              {a.phone && <div className="text-slate-500 text-xs mt-0.5">Phone: {a.phone}</div>}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-1">
                              <button
                                className="px-2 py-1 text-xs rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 whitespace-nowrap"
                                onClick={() => { setAddrToEdit(a); setShowAddrModal(true) }}
                              >Edit</button>
                              <button
                                className="px-2 py-1 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 whitespace-nowrap"
                                onClick={async () => {
                                  if (!confirm('Delete this address?')) return
                                  try {
                                    const token = await auth.currentUser.getIdToken(true)
                                    await axios.delete(`/api/address?id=${a.id || a._id}`, { headers: { Authorization: `Bearer ${token}` } })
                                    toast.success('Address deleted')
                                    setAddresses(addresses.filter((x) => (x.id || x._id) !== (a.id || a._id)))
                                  } catch (err) {
                                    toast.error(err?.response?.data?.error || 'Delete failed')
                                  }
                                }}
                              >Delete</button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <AddressModal
                  open={showAddrModal}
                  setShowAddressModal={setShowAddrModal}
                  isEdit={!!addrToEdit}
                  initialAddress={addrToEdit}
                  onAddressAdded={(newAddr) => setAddresses([newAddr, ...addresses])}
                  onAddressUpdated={(upd) => setAddresses(addresses.map((x) => (x.id === upd.id ? upd : x)))}
                />
              </div>
            </>
          )}
        </main>
      </div>
    )
}
