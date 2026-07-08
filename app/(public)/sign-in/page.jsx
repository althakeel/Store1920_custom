import { Suspense } from 'react'
import SignInClient from './SignInClient'

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    }>
      <SignInClient />
    </Suspense>
  )
}
