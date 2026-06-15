import { Suspense } from 'react'
import SignInClient from './SignInClient'
import GoogleOneTap from '@/components/GoogleOneTap'

export default function SignInPage() {
  return (
    <Suspense fallback={
  <div className="flex items-center justify-center py-12">
        <div>Loading...</div>
      </div>
    }>
      <GoogleOneTap />
      <SignInClient />
    </Suspense>
  )
}
