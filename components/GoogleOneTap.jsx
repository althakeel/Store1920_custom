'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import toast from 'react-hot-toast'
import { auth } from '@/lib/firebase'

export default function GoogleOneTap() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const initializedRef = useRef(false)
  const signingInRef = useRef(false)
  const redirectToRef = useRef('/')
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  useEffect(() => {
    redirectToRef.current = searchParams.get('redirect_to') || '/'
  }, [searchParams])

  useEffect(() => {
    if (!clientId || !scriptLoaded || initializedRef.current) return
    if (typeof window === 'undefined' || !window.google?.accounts?.id) return
    if (auth.currentUser) return

    window.google.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: false,
      callback: async ({ credential }) => {
        if (!credential || signingInRef.current) return

        try {
          signingInRef.current = true
          const firebaseCredential = GoogleAuthProvider.credential(credential)
          await signInWithCredential(auth, firebaseCredential)
          router.push(redirectToRef.current || '/')
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
      // Ignore prompt errors during page transitions.
    }
  }, [clientId, router, scriptLoaded])

  if (!clientId) return null

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onLoad={() => setScriptLoaded(true)}
    />
  )
}
