'use client'


import Link from "next/link"
import Image from "next/image";
import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";
import Logo from "../../assets/logo/logo.png";
import { useAuth } from "@/lib/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

const SELLER_LOGO_MAX_WIDTH = 140;
const SELLER_LOGO_MAX_HEIGHT = 36;

function clampSellerLogoDimensions(width, height) {
    const parsedWidth = Number(width);
    const parsedHeight = Number(height);
    const safeWidth = Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : 120;
    const safeHeight = Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : 40;

    return {
        width: Math.min(safeWidth, SELLER_LOGO_MAX_WIDTH),
        height: Math.min(safeHeight, SELLER_LOGO_MAX_HEIGHT),
    };
}

const StoreNavbar = ({ storeInfo }) => {
    const { user, getToken } = useAuth();
    const [showConfirm, setShowConfirm] = useState(false);
    const [navbarLogo, setNavbarLogo] = useState({ url: '', width: 120, height: 40, backgroundColor: '#ffffff' });

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
                const dims = clampSellerLogoDimensions(
                    data.logoWidth || 120,
                    data.logoHeight || 40
                );
                setNavbarLogo((prev) => ({
                    url: data.logoUrl || prev.url,
                    width: dims.width,
                    height: dims.height,
                    backgroundColor: data.backgroundColor || prev.backgroundColor || '#ffffff',
                }));
            } catch (e) {
                // silently fail, fall back to default logo
            }
        };
        if (user) fetchLogo();
    }, [user]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleNavbarAppearanceUpdate = (event) => {
            const detail = event?.detail || {};
            setNavbarLogo((prev) => {
                const dims = clampSellerLogoDimensions(
                    Number.isFinite(Number(detail.logoWidth)) ? Number(detail.logoWidth) : prev.width,
                    Number.isFinite(Number(detail.logoHeight)) ? Number(detail.logoHeight) : prev.height
                );
                return {
                    ...prev,
                    url: typeof detail.logoUrl === 'string' ? detail.logoUrl : prev.url,
                    width: dims.width,
                    height: dims.height,
                    backgroundColor: typeof detail.backgroundColor === 'string' ? detail.backgroundColor : prev.backgroundColor,
                };
            });
        };

        window.addEventListener('navbarAppearanceUpdated', handleNavbarAppearanceUpdate);
        return () => window.removeEventListener('navbarAppearanceUpdated', handleNavbarAppearanceUpdate);
    }, []);

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
        <div className="flex items-center justify-between px-4 py-2 lg:px-6 border-b border-slate-200 bg-white text-slate-900 shadow-sm transition-all">
            <Link href="/store" className="relative flex items-center">
                {navbarLogo.url ? (
                  <img
                    src={navbarLogo.url}
                    alt={storeInfo?.name || 'Store Logo'}
                    width={navbarLogo.width}
                    height={navbarLogo.height}
                    className="h-auto w-auto max-h-9 max-w-[140px] object-contain"
                    style={{ width: navbarLogo.width, height: navbarLogo.height }}
                  />
                ) : (
                  <Image
                    src={Logo}
                    alt="Store1920 Logo"
                    width={140}
                    height={36}
                    className="max-h-9 max-w-[140px] object-contain"
                    priority
                  />
                )}
            </Link>
            <div className="flex items-center gap-2 text-sm text-slate-700">
                <p className="hidden sm:block">Hi, {storeInfo?.name || user?.displayName || user?.name || user?.email || ''}</p>
                <button
                    onClick={() => setShowConfirm(true)}
                    className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition shadow-sm"
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