'use client'

import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/useAuth'
import { linkGuestOrdersForCurrentUser } from '@/lib/linkGuestOrdersClient'

export default function GuestOrderLinker() {
    const { user, loading, getToken } = useAuth()
    const isSignedIn = !!user
    const linkingRef = useRef(false)
    const lastAttemptRef = useRef({ uid: null, at: 0 })

    useEffect(() => {
        let active = true

        const linkGuestOrders = async () => {
            if (loading || !isSignedIn || !user?.uid) return

            const now = Date.now()
            const lastAttempt = lastAttemptRef.current
            const recentlyAttempted = lastAttempt.uid === user.uid && now - lastAttempt.at < 15000
            if (recentlyAttempted || linkingRef.current) return

            try {
                const token = await getToken()
                if (!token || !active) return

                linkingRef.current = true
                lastAttemptRef.current = { uid: user.uid, at: now }

                const data = await linkGuestOrdersForCurrentUser(user, token)

                if (!active) return

                if (data?.linked && data.count > 0) {
                    toast.success(`Welcome back! We've linked ${data.count} previous order(s) to your account.`, {
                        duration: 5000
                    })
                }
            } catch (error) {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('Failed to link guest orders:', error)
                }
            } finally {
                linkingRef.current = false
            }
        }

        const timer = setTimeout(linkGuestOrders, 300)
        const retryTimer = setTimeout(linkGuestOrders, 2500)

        return () => {
            active = false
            clearTimeout(timer)
            clearTimeout(retryTimer)
            linkingRef.current = false
        }
    }, [isSignedIn, user, getToken, loading])

    return null
}
