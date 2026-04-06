'use client'


import Link from "next/link"
import Image from "next/image";
import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";
import Logo from "../../assets/logo/logo.png";
import { useAuth } from "@/lib/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";


const StoreNavbar = ({ storeInfo }) => {
    const { user, getToken } = useAuth();
    const [showConfirm, setShowConfirm] = useState(false);
    const [navbarLogo, setNavbarLogo] = useState({ url: '', width: 120, height: 40 });

    useEffect(() => {
        const fetchLogo = async () => {
            try {
                let token = await getToken();
                if (!token) {
                    token = await getToken(true);
                }
                if (!token) return;
                const res = await fetch('/api/store/navbar-menu', {
                    cache: 'no-store',
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (data.logoUrl) {
                    setNavbarLogo({ url: data.logoUrl, width: data.logoWidth || 120, height: data.logoHeight || 40 });
                }
            } catch (e) {
                // silently fail, fall back to default logo
            }
        };
        if (user) fetchLogo();
    }, [user]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            window.location.href = "/";
        } catch (error) {
            console.error("Logout failed", error);
        } finally {
            setShowConfirm(false);
        }
    };

    return (
        <div className="flex items-center justify-between px-12 py-3 border-b border-slate-200 transition-all">
            <Link href="/store" className="relative text-4xl font-semibold text-slate-700">
                {navbarLogo.url ? (
                  <img
                    src={navbarLogo.url}
                    alt={storeInfo?.name || 'Store Logo'}
                    style={{ width: navbarLogo.width, height: navbarLogo.height, objectFit: 'contain' }}
                  />
                ) : (
                  <Image
                    src={Logo}
                    alt="Store1920 Logo"
                    width={180}
                    height={48}
                    className="object-contain"
                    priority
                  />
                )}
            </Link>
            <div className="flex items-center gap-3">
                <p>Hi, {storeInfo?.name || user?.displayName || user?.name || user?.email || ''}</p>
                <button
                    onClick={() => setShowConfirm(true)}
                    className="ml-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                >
                    Logout
                </button>
            </div>

            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                        onClick={() => setShowConfirm(false)}
                    />
                    <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="absolute -left-10 -top-14 h-40 w-40 bg-red-400/20 blur-3xl" />
                        <div className="absolute -right-8 -bottom-12 h-36 w-36 bg-orange-300/20 blur-3xl" />
                        <div className="relative p-6">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                                <LogOut size={24} />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 text-center">Sign out of seller mode?</h3>
                            <p className="mt-2 text-sm text-slate-600 text-center">You can return anytime. We will keep your work safe.</p>
                            <div className="mt-5 grid grid-cols-2 gap-3">
                                <button
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                                    onClick={() => setShowConfirm(false)}
                                >
                                    Stay
                                </button>
                                <button
                                    className="w-full rounded-xl bg-gradient-to-r from-red-500 to-orange-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200/50 hover:brightness-105 transition"
                                    onClick={handleLogout}
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default StoreNavbar