import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import { auth, googleProvider, waitForAuthReady } from './firebase';

let activeAuthOperation = null;

const AUTH_LOCK_WAIT_MS = 60000;
const POPUP_TIMEOUT_MS = 45000;

function withTimeout(promise, ms, timeoutMessage) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(timeoutMessage);
      error.code = 'auth/timeout';
      reject(error);
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

async function runWithAuthLock(operation) {
  if (activeAuthOperation) {
    try {
      await withTimeout(
        activeAuthOperation,
        AUTH_LOCK_WAIT_MS,
        'Previous sign-in timed out'
      );
    } catch {
      // Start a fresh attempt even if the prior one hung.
    }

    if (activeAuthOperation) {
      activeAuthOperation = null;
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
  return runWithAuthLock(() =>
    withTimeout(
      signInWithPopup(auth, googleProvider),
      POPUP_TIMEOUT_MS,
      'Google sign-in timed out. Allow pop-ups, complete the Google window, or try again.'
    )
  );
}

export async function signInWithGoogleRedirect() {
  return runWithAuthLock(() => signInWithRedirect(auth, googleProvider));
}

export async function consumeGoogleRedirectResult() {
  await waitForAuthReady();
  return getRedirectResult(auth);
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
  if (code === 'auth/popup-blocked') {
    return 'Pop-up blocked. Allow pop-ups for this site, or use username/email sign-in.';
  }
  if (code === 'auth/timeout' || msg.includes('timed out')) {
    return 'Google sign-in timed out. Allow pop-ups, finish the Google window, or use username/email sign-in.';
  }
  if (code === 'auth/network-request-failed') return 'Network error. Please check your connection.';
  if (code === 'auth/user-not-found') return 'No account found with this email or username.';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Invalid email/username or password.';
  }
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/user-disabled') return 'This account has been disabled.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait and try again.';
  if (code === 'auth/operation-not-supported-in-this-environment') {
    return 'Google pop-up sign-in is not supported here. Redirecting to Google sign-in...';
  }
  if (msg.includes('internal assertion failed') || msg.includes('pending promise')) {
    return 'Sign-in was interrupted. Please wait a moment and try again.';
  }
  if (msg.includes('you do not have seller access')) {
    return 'You do not have seller access';
  }
  if (msg.includes('store access check failed temporarily')) {
    return 'Store access check failed temporarily. Please try again.';
  }

  return err?.message || fallback;
}
