import { getAuth } from '@/lib/firebase-admin'
import authAdmin from '@/middlewares/authAdmin'
import authSeller from '@/middlewares/authSeller'
import { getFirebaseAdminUserMessage } from '@/lib/firebaseAdminErrors'

export async function verifyHomeSectionAccess(request) {
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
      reason: 'missing-token',
    }
  }

  const idToken = authHeader.split(' ')[1]

  let decodedToken
  try {
    decodedToken = await getAuth().verifyIdToken(idToken)
  } catch (error) {
    return {
      ok: false,
      status: 401,
      error: getFirebaseAdminUserMessage(error),
      reason: 'invalid-token',
    }
  }

  const userId = decodedToken.uid
  const email = decodedToken.email || ''
  const isAdmin = await authAdmin(userId, email)
  const storeId = isAdmin ? null : await authSeller(userId)

  if (!isAdmin && !storeId) {
    return {
      ok: false,
      status: 403,
      error: 'You do not have permission to manage home sections.',
      reason: 'not-admin-or-seller',
    }
  }

  return {
    ok: true,
    userId,
    email,
    isAdmin: Boolean(isAdmin),
    storeId,
  }
}
