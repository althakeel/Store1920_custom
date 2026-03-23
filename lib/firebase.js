// lib/firebase.js

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";

// COMPAT IMPORT for OTP + Recaptcha
import firebase from "firebase/compat/app";
import "firebase/compat/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAYtazCFhDWG4t0hUQZpS5lmMqIGKpTzpo",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "brandstored-ecommerce.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "brandstored-ecommerce",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "brandstored-ecommerce.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "473801367272",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:473801367272:web:589532550f7cb84f40f35d",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-4MNF4TT1VK"
};

// ------------------------------
// Initialize modular app
// ------------------------------
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Modular Auth
export const auth = getAuth(app);

// Ensure user stays logged in until sign out
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// ------------------------------
// Initialize COMPAT Firebase (required for RecaptchaVerifier + OTP)
// ------------------------------
if (typeof window !== "undefined") {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  window.firebase = firebase;
}

// ------------------------------
// Recaptcha Verifier Helper
// ------------------------------
export const getRecaptchaVerifier = () => {
  if (typeof window === "undefined") return null;

  const compat = window.firebase?.auth;
  if (!compat) return null;

  return new compat.RecaptchaVerifier(
    "recaptcha-container",
    { size: "invisible" },
    auth
  );
};

export default app;
