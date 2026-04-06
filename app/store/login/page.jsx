'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import toast from 'react-hot-toast'
import Image from 'next/image'
import Logo from '@/assets/logo/logo.png'
import { useAuth } from '@/lib/useAuth'

export default function StoreLogin() {
  const router = useRouter()
  const { user, loading: authLoading, getToken } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Check if already logged in and has seller access
  useEffect(() => {
    const checkAccess = async () => {
      if (authLoading) return
      
      if (user) {
        try {
          const token = await getToken()
          const response = await fetch('/api/store/is-seller', {
            headers: { Authorization: `Bearer ${token}` }
          })
          const data = await response.json()
          
          if (data.isSeller) {
            router.push('/store')
          }
        } catch (error) {
          console.error('Error checking seller status:', error)
        }
      }
    }
    
    checkAccess()
  }, [user, authLoading, getToken, router])

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      // Check if user has seller access
      const token = await user.getIdToken()
      const response = await fetch('/api/store/is-seller', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      
      if (!response.ok && data?.reason === 'database-unavailable') {
        toast.error('Store access check failed because the database is unreachable. Try again when the server connection is restored.')
        return
      }

      if (data.isSeller) {
        toast.success('Login successful!')
        router.push('/store')
      } else {
        await auth.signOut()
        toast.error('You do not have seller access')
      }
    } catch (error) {
      console.error('Login error:', error)
      let errorMessage = 'Invalid credentials';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message.replace('Firebase: Error', '').replace(/\(.*?\)/g, '').trim() || 'Invalid credentials';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      const userCredential = await signInWithPopup(auth, provider)
      const user = userCredential.user
      
      // Check if user has seller access
      const token = await user.getIdToken()
      const response = await fetch('/api/store/is-seller', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      
      if (!response.ok && data?.reason === 'database-unavailable') {
        toast.error('Store access check failed because the database is unreachable. Try again when the server connection is restored.')
        return
      }

      if (data.isSeller) {
        toast.success('Login successful!')
        router.push('/store')
      } else {
        await auth.signOut()
        toast.error('You do not have seller access')
      }
    } catch (error) {
      console.error('Google login error:', error)
      let errorMessage = 'Login failed';
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in cancelled. Please try again.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Pop-up blocked. Please allow pop-ups and try again.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Sign-in cancelled. Please try again.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message.replace('Firebase: Error', '').replace(/\(.*?\)/g, '').trim() || 'Login failed';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Image src={Logo} alt="Logo" width={160} height={50} className="object-contain" />
          </div>
          
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">
            Store Dashboard Login
          </h1>
          <p className="text-center text-slate-500 mb-8">
            Sign in to access your seller dashboard
          </p>

          {/* Demo Credentials Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm font-semibold text-blue-900 mb-2">📋 Demo Credentials:</p>
            <div className="space-y-1 text-sm text-blue-800">
              <p><span className="font-medium">Email:</span>support@Store1920.com</p>
              <p><span className="font-medium">Password:</span> Contact admin</p>
            </div>
          </div>

          {/* Email Login Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seller@example.com"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">Or continue with</span>
            </div>
          </div>

          {/* Google Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>

          {/* Back to Home */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-sm text-slate-600 hover:text-slate-800 transition"
            >
              ← Back to home
            </button>
          </div>
        </div>

        {/* Info */}
        <p className="mt-6 text-center text-sm text-slate-500">
          Only authorized sellers can access the dashboard
        </p>
      </div>
    </div>
  )
}
