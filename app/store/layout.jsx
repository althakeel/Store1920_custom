'use client'
import StoreLayout from "@/components/store/StoreLayout";

import { ImageKitContext } from '@imagekit/next'
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth"
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export default function RootAdminLayout({ children }) {
    const { user, loading } = useAuth();
    const [mounted, setMounted] = useState(false);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const pathname = usePathname();

    const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY
    const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT

    useEffect(() => {
        setMounted(true)
    }, [])

    const authenticator = async () => {
        try {
            const response = await fetch('/api/imagekit-auth')
            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Request failed with status ${response.status}: ${errorText}`)
            }
            const data = await response.json()
            const { signature, expire, token } = data
            return { signature, expire, token }
        } catch (error) {
            throw new Error(`Authentication request failed: ${error.message}`)
        }
    }

    const handleGoogleSignIn = async () => {
        try {
            setIsSigningIn(true);
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            let errorMessage = 'Sign in failed';
            if (error.code === 'auth/popup-closed-by-user') {
                errorMessage = 'Sign-in cancelled. Please try again.';
            } else if (error.code === 'auth/popup-blocked') {
                errorMessage = 'Pop-up blocked. Please allow pop-ups and try again.';
            } else if (error.code === 'auth/cancelled-popup-request') {
                errorMessage = 'Sign-in cancelled. Please try again.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your connection.';
            } else if (error.message) {
                errorMessage = error.message.replace('Firebase: Error', '').replace(/\\(.*?\\)/g, '').trim() || 'Sign in failed';
            }
            alert(errorMessage);
        } finally {
            setIsSigningIn(false);
        }
    };

    if (!mounted || loading) {
        return null;
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-100 px-4 flex items-center justify-center">
                <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-2xl shadow-slate-300/50 p-8 sm:p-10 text-center">
                    <div className="mx-auto mb-5 h-12 w-12 rounded-2xl bg-blue-600/10 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6 text-blue-600" fill="currentColor" aria-hidden="true">
                            <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 2a8 8 0 0 1 6.9 12H5.1A8 8 0 0 1 12 4Zm0 16a7.96 7.96 0 0 1-5.46-2.16h10.92A7.96 7.96 0 0 1 12 20Z" />
                        </svg>
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
                    <p className="mt-2 text-sm text-slate-600">Sign in to continue to your store dashboard.</p>

                    <button
                        onClick={handleGoogleSignIn}
                        disabled={isSigningIn}
                        className="mt-7 w-full inline-flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.21 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C34.046 6.053 29.27 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C34.046 6.053 29.27 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                            <path fill="#4CAF50" d="M24 44c5.168 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.146 35.091 26.715 36 24 36c-5.189 0-9.625-3.327-11.287-7.946l-6.522 5.025C9.504 39.556 16.684 44 24 44z"/>
                            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.046 12.046 0 0 1-4.084 5.57h.003l6.19 5.238C36.97 39.093 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                        </svg>
                        {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
                    </button>

                    <p className="mt-4 text-xs text-slate-500">Only authorized accounts can access this area.</p>
                </div>
            </div>
        );
    }

    const isInviteAcceptPage = pathname?.startsWith('/store/invite/accept');
    if (isInviteAcceptPage) {
        return children;
    }

    return (
        <ImageKitContext.Provider value={{ publicKey, urlEndpoint, authenticator }}>
            <StoreLayout>
                {children}
            </StoreLayout>
        </ImageKitContext.Provider>
    );
}
