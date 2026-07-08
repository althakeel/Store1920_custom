'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SignInModal from '@/components/SignInModal'

export default function SignInClient() {
  const params = useSearchParams()
  const router = useRouter()
  const [redirect, setRedirect] = useState('/')
  const [defaultMode, setDefaultMode] = useState('login')

  useEffect(() => {
    setRedirect(params.get('redirect_to') || '/')
    setDefaultMode(params.get('mode') === 'register' ? 'register' : 'login')
  }, [params])

  return (
    <SignInModal
      open
      variant="page"
      defaultMode={defaultMode}
      onClose={() => router.push(redirect)}
    />
  )
}
