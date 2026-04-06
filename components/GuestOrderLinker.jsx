'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/useAuth'

export default function GuestOrderLinker() {
    const { user, loading, getToken } = useAuth()
    const isSignedIn = !!user
    const [checked, setChecked] = useState(false)

    useEffect(() => {
        const controller = new AbortController()
        let active = true

        const linkGuestOrders = async () => {
            // Skip if still loading, not signed in, or already checked
            if (loading || !isSignedIn || checked) return

            try {
                const token = await getToken()
                if (!token) return

                const email = user?.email
                const phone = user?.phoneNumber

                if (!email && !phone) return

                const { data } = await axios.post('/api/user/link-guest-orders', {
                    email,
                    phone
                }, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal,
                    timeout: 10000
                })

                if (!active) return

                if (data.linked && data.count > 0) {
                    toast.success(`Welcome back! We've linked ${data.count} previous order(s) to your account.`, {
                        duration: 5000
                    })
                }

                setChecked(true)
            } catch (error) {
                if (axios.isCancel(error) || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
                    return
                }

                // Silently fail - this is a background operation
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('Failed to link guest orders:', error)
                }
                if (active) {
                    setChecked(true)
                }
            }
        }

        // Run after a short delay to avoid blocking initial page load
        const timer = setTimeout(linkGuestOrders, 1500)

        return () => {
            active = false
            clearTimeout(timer)
            controller.abort()
        }
    }, [isSignedIn, user, getToken, loading, checked])

    return null // This component doesn't render anything
}
