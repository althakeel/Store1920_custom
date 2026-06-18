'use client'

import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'

import Loading from '@/components/Loading'
import Link from 'next/link'
import DashboardSidebar from '@/components/DashboardSidebar'
import ProductCard from '@/components/ProductCard'
import axios from 'axios'

export default function BrowseHistoryPage() {
  const [user, setUser] = useState(undefined)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null)
      if (u) fetchHistory(u)
    })
    return () => unsub()
  }, [])

  const fetchHistory = async (currentUser) => {
    try {
      setLoading(true)
      const token = await currentUser.getIdToken()
      const { data } = await axios.get('/api/browse-history', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setHistory(data.history || [])
    } catch (error) {
      console.error('Failed to fetch browse history:', error)
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear your browse history?')) return
    
    try {
      setClearing(true)
      const token = await user.getIdToken()
      await axios.delete('/api/browse-history', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setHistory([])
    } catch (error) {
      alert('Failed to clear history. Please try again.')
    } finally {
      setClearing(false)
    }
  }

  if (user === undefined) return <Loading />

  if (user === null) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-semibold text-slate-800 mb-3">Browse History</h1>
          <p className="text-slate-600 mb-6">Please sign in to view your browse history.</p>
          <Link href="/" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Go to Home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-4 gap-6">
      <DashboardSidebar />
      <main className="md:col-span-3">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-slate-800">Browse History</h1>
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              disabled={clearing}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {clearing ? 'Clearing...' : 'Clear History'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
            <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading your history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">👀</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No Browse History Yet</h2>
            <p className="text-gray-600 mb-6">Your recently viewed products will appear here.</p>
            <Link href="/shop" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Start Shopping
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Showing {history.length} recently viewed {history.length === 1 ? 'product' : 'products'}
            </p>
            <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {history.map((item) => (
                <ProductCard key={item._id} product={item.product} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

