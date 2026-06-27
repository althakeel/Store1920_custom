import { Suspense } from 'react'
import SignInClient from './SignInClient'

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div>Loading...</div>
      </div>
    }>
      <SignInClient />
    </Suspense>
  )
}
