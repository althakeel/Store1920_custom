import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth, googleProvider, waitForAuthReady } from './firebase';

let activeAuthOperation = null;

async function runWithAuthLock(operation) {
  if (activeAuthOperation) {
    try {
      await activeAuthOperation;
    } catch {
      // Ignore prior failure; start a fresh attempt.
    }
  }

  const current = (async () => {
    await waitForAuthReady();
    return operation();
  })();

  activeAuthOperation = current;

  try {
    return await current;
  } finally {
    if (activeAuthOperation === current) {
      activeAuthOperation = null;
    }
  }
}

export async function signInWithGooglePopup() {
  return runWithAuthLock(() => signInWithPopup(auth, googleProvider));
}

export async function signInWithGoogleCredential(credential) {
  const firebaseCredential = GoogleAuthProvider.credential(credential);
  return runWithAuthLock(() => signInWithCredential(auth, firebaseCredential));
}

export async function signInWithEmail(email, password) {
  return runWithAuthLock(() => signInWithEmailAndPassword(auth, email, password));
}

export function getAuthErrorMessage(err, fallback = 'Sign in failed. Please try again.') {
  const code = err?.code || '';
  const msg = String(err?.message || '').toLowerCase();

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Sign-in cancelled. Please try again.';
  }
  if (code === 'auth/popup-blocked') return 'Pop-up blocked. Please allow pop-ups and try again.';
  if (code === 'auth/network-request-failed') return 'Network error. Please check your connection.';
  if (code === 'auth/user-not-found') return 'No account found with this email or username.';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Invalid email/username or password.';
  }
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/user-disabled') return 'This account has been disabled.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait and try again.';
  if (msg.includes('internal assertion failed') || msg.includes('pending promise')) {
    return 'Sign-in was interrupted. Please wait a moment and try again.';
  }

  return fallback;
}
