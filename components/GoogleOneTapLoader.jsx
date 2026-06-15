'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import GoogleOneTap from '@/components/GoogleOneTap'

function GoogleOneTapGate() {
  const pathname = usePathname()

  if (pathname?.startsWith('/admin') || pathname?.startsWith('/store')) {
    return null
  }

  return <GoogleOneTap />
}

export default function GoogleOneTapLoader() {
  return (
    <Suspense fallback={null}>
      <GoogleOneTapGate />
    </Suspense>
  )
}
