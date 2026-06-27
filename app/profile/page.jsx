'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Loading from '@/components/Loading'

export default function ProfilePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/profile')
  }, [router])

  return <Loading />
}
