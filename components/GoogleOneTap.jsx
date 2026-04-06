'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential } from 'firebase/auth'
import toast from 'react-hot-toast'
import { auth } from '@/lib/firebase'

const DISABLED_PATH_PREFIXES = ['/admin', '/store']

export default function GoogleOneTap() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const initializedRef = useRef(false)
  const signingInRef = useRef(false)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && window.google?.accounts?.id) {
        window.google.accounts.id.cancel()
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!clientId || !scriptLoaded || initializedRef.current) return
    if (typeof window === 'undefined' || !window.google?.accounts?.id) return
    if (auth.currentUser) return
    if (DISABLED_PATH_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return

    window.google.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: true,
      callback: async ({ credential }) => {
        if (!credential || signingInRef.current) return

        try {
          signingInRef.current = true
          const firebaseCredential = GoogleAuthProvider.credential(credential)
          await signInWithCredential(auth, firebaseCredential)

          const redirectTo = searchParams.get('redirect_to') || '/'
          if (pathname?.includes('/sign-in')) {
            router.push(redirectTo)
          } else {
            router.refresh()
          }
        } catch (error) {
          console.error('[GoogleOneTap] Sign-in failed:', error)
          toast.error('Google One Tap sign-in failed')
        } finally {
          signingInRef.current = false
        }
      },
    })

    initializedRef.current = true
    window.google.accounts.id.prompt()

    return () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel()
      }
      initializedRef.current = false
    }
  }, [clientId, pathname, router, scriptLoaded, searchParams])

  if (!clientId) return null

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onLoad={() => setScriptLoaded(true)}
    />
  )
}