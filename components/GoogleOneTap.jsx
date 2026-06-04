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
  const redirectToRef = useRef('/')
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const fedCmMode = (process.env.NEXT_PUBLIC_GOOGLE_ONE_TAP_FEDCM || 'off').toLowerCase()
  // Keep FedCM opt-in only. Use NEXT_PUBLIC_GOOGLE_ONE_TAP_FEDCM=force to enable.
  const useFedCmPrompt = process.env.NODE_ENV === 'production' && fedCmMode === 'force'

  const safeCancelOneTap = () => {
    try {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel()
      }
    } catch {
      // Swallow noisy browser/library cleanup errors.
    }
  }

  useEffect(() => {
    redirectToRef.current = searchParams.get('redirect_to') || '/'
  }, [searchParams])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !useFedCmPrompt) {
        safeCancelOneTap()
      }
    })

    return () => unsubscribe()
  }, [useFedCmPrompt])

  useEffect(() => {
    if (!clientId || !scriptLoaded || initializedRef.current) return
    if (typeof window === 'undefined' || !window.google?.accounts?.id) return
    if (auth.currentUser) return
    if (DISABLED_PATH_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return

    window.google.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: useFedCmPrompt,
      callback: async ({ credential }) => {
        if (!credential || signingInRef.current) return

        try {
          signingInRef.current = true
          const firebaseCredential = GoogleAuthProvider.credential(credential)
          await signInWithCredential(auth, firebaseCredential)

          const redirectTo = redirectToRef.current || '/'
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
    try {
      window.google.accounts.id.prompt()
    } catch {
      // Ignore prompt errors; Google script can throw during rapid route changes.
    }

    return () => {
      // Canceling an active FedCM prompt during route cleanup can trigger
      // noisy AbortError logs in the browser console.
      if (!useFedCmPrompt) {
        safeCancelOneTap()
      }
      initializedRef.current = false
    }
  }, [clientId, pathname, router, scriptLoaded, useFedCmPrompt])

  if (!clientId) return null

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onLoad={() => setScriptLoaded(true)}
    />
  )
}