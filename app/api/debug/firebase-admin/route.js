import { NextResponse } from 'next/server'
import { getAuth, getFirebaseServiceAccountDiagnostics } from '@/lib/firebase-admin'
import { getFirebaseAdminUserMessage } from '@/lib/firebaseAdminErrors'

export const runtime = 'nodejs'

export async function GET() {
  const diagnostics = getFirebaseServiceAccountDiagnostics()

  if (!diagnostics.parseOk) {
    return NextResponse.json(
      {
        success: false,
        diagnostics,
        fixSteps: [
          'Download a new service account JSON from Firebase Console.',
          'Save it as firebase-service-account.json in the project root.',
          'Add FIREBASE_SERVICE_ACCOUNT_KEY_PATH=./firebase-service-account.json to .env',
          'Ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID matches the JSON project_id.',
          'Restart npm run dev.',
        ],
      },
      { status: 500 }
    )
  }

  if (diagnostics.error) {
    return NextResponse.json(
      {
        success: false,
        diagnostics,
        fixSteps: [
          'Check that NEXT_PUBLIC_FIREBASE_PROJECT_ID matches the service account project_id.',
          'Regenerate the Firebase service account key if the key was revoked.',
          'Restart npm run dev after updating .env.',
        ],
      },
      { status: 500 }
    )
  }

  try {
    await getAuth().listUsers(1)

    return NextResponse.json({
      success: true,
      diagnostics,
      message: 'Firebase Admin credentials are valid.',
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        diagnostics,
        error: getFirebaseAdminUserMessage(error),
        fixSteps: [
          'Regenerate the service account key in Firebase Console.',
          'Replace firebase-service-account.json or FIREBASE_SERVICE_ACCOUNT_KEY in .env.',
          'Restart npm run dev.',
          'Sync Windows date/time if the error mentions invalid_grant.',
        ],
      },
      { status: 500 }
    )
  }
}
