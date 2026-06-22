'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function Banner2SectionRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/store/preferences?tab=banner2')
  }, [router])

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-white">
      <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
    </div>
  )
}
