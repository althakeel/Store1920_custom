import fs from 'fs'
import path from 'path'

function normalizePrivateKey(serviceAccount) {
  if (!serviceAccount || typeof serviceAccount.private_key !== 'string') {
    return serviceAccount
  }

  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
  return serviceAccount
}

function parseServiceAccountJson(rawValue = '') {
  let value = String(rawValue || '').trim()

  if (!value) {
    throw new Error('Firebase service account value is empty.')
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  const parsed = JSON.parse(value)
  return normalizePrivateKey(parsed)
}

function readServiceAccountFromFile(filePath = '') {
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath)

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Firebase service account file was not found at ${resolvedPath}`)
  }

  const fileContents = fs.readFileSync(resolvedPath, 'utf8')
  return parseServiceAccountJson(fileContents)
}

export function loadFirebaseServiceAccount() {
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH?.trim()
  const inlineKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()

  if (filePath) {
    return readServiceAccountFromFile(filePath)
  }

  if (inlineKey) {
    return parseServiceAccountJson(inlineKey)
  }

  return null
}

export function getFirebaseServiceAccountDiagnostics() {
  const expectedProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || ''
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH?.trim() || ''
  const inlineKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim() || ''

  const diagnostics = {
    hasInlineKey: Boolean(inlineKey),
    hasKeyFilePath: Boolean(filePath),
    expectedProjectId,
    source: filePath ? 'file' : inlineKey ? 'env' : 'missing',
    parseOk: false,
    serviceAccountProjectId: '',
    clientEmailDomain: '',
    privateKeyLooksValid: false,
    projectMatch: false,
    error: '',
  }

  try {
    const serviceAccount = loadFirebaseServiceAccount()
    if (!serviceAccount) {
      diagnostics.error = 'No Firebase service account configured.'
      return diagnostics
    }

    diagnostics.parseOk = true
    diagnostics.serviceAccountProjectId = serviceAccount.project_id || ''
    diagnostics.clientEmailDomain = String(serviceAccount.client_email || '').split('@')[1] || ''
    diagnostics.privateKeyLooksValid = String(serviceAccount.private_key || '').includes('BEGIN PRIVATE KEY')
    diagnostics.projectMatch =
      !expectedProjectId || diagnostics.serviceAccountProjectId === expectedProjectId

    if (!diagnostics.privateKeyLooksValid) {
      diagnostics.error = 'Service account private_key is missing or malformed.'
    } else if (!diagnostics.projectMatch) {
      diagnostics.error = 'Service account project_id does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID.'
    }
  } catch (error) {
    diagnostics.error = error.message || 'Failed to load Firebase service account.'
  }

  return diagnostics
}
