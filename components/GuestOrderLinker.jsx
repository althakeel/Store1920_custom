'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/useAuth'
import { linkGuestOrdersForCurrentUser } from '@/lib/linkGuestOrdersClient'

export default function GuestOrderLinker() {
    const { user, loading, getToken } = useAuth()
    const isSignedIn = !!user
    const [checkedUid, setCheckedUid] = useState(null)
    const linkingRef = useRef(false)

    useEffect(() => {
        const controller = new AbortController()
        let active = true

        const linkGuestOrders = async () => {
            if (loading || !isSignedIn || !user?.uid) return
            if (checkedUid === user.uid || linkingRef.current) return

            try {
                const token = await getToken()
                if (!token || !active) return

                linkingRef.current = true

                const data = await linkGuestOrdersForCurrentUser(user, token)

                if (!active) return

                if (data?.linked && data.count > 0) {
                    toast.success(`Welcome back! We've linked ${data.count} previous order(s) to your account.`, {
                        duration: 5000
                    })
                }

                setCheckedUid(user.uid)
            } catch (error) {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('Failed to link guest orders:', error)
                }
                if (active) {
                    setCheckedUid(user.uid)
                }
            } finally {
                linkingRef.current = false
            }
        }

        const timer = setTimeout(linkGuestOrders, 300)

        return () => {
            active = false
            clearTimeout(timer)
            controller.abort()
            linkingRef.current = false
        }
    }, [isSignedIn, user, getToken, loading, checkedUid])

    return null
}
