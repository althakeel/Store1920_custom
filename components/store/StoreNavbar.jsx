'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut } from 'lucide-react';
import Logo from '@/assets/logo/Store1920.png';
import { useAuth } from '@/lib/useAuth';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useStoreOrderNotifications } from './StoreOrderNotificationProvider';

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
    const { unreadCount, recentOrders, canViewOrders, markAllRead } = useStoreOrderNotifications();
    const [showConfirm, setShowConfirm] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [navbarLogo, setNavbarLogo] = useState({ url: '', width: 120, height: 40, backgroundColor: '#ffffff' });
    const notificationRef = useRef(null);

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
    }, [user, getToken]);

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

    useEffect(() => {
        if (!showNotifications) return undefined;

        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showNotifications]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            window.location.href = '/';
        } catch (error) {
            console.error('Logout failed', error);
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
                {canViewOrders ? (
                    <div className="relative" ref={notificationRef}>
                        <button
                            type="button"
                            onClick={() => setShowNotifications((open) => !open)}
                            className="relative rounded-md border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
                            aria-label="Order notifications"
                        >
                            <Bell size={18} />
                            {unreadCount > 0 ? (
                                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            ) : null}
                        </button>

                        {showNotifications ? (
                            <div className="absolute end-0 top-[calc(100%+8px)] z-50 w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Order alerts</p>
                                        <p className="text-xs text-slate-500">New orders appear here instantly</p>
                                    </div>
                                    {unreadCount > 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                markAllRead();
                                                setShowNotifications(false);
                                            }}
                                            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                                        >
                                            Mark read
                                        </button>
                                    ) : null}
                                </div>
                                <div className="max-h-72 overflow-y-auto">
                                    {recentOrders.length > 0 ? (
                                        recentOrders.map((order) => (
                                            <Link
                                                key={order.orderId}
                                                href="/store/orders"
                                                onClick={() => {
                                                    markAllRead();
                                                    setShowNotifications(false);
                                                }}
                                                className="block border-b border-slate-100 px-4 py-3 hover:bg-emerald-50/60"
                                            >
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {order.shortOrderNumber ? `#${order.shortOrderNumber}` : 'New order'}
                                                    <span className="ms-2 font-normal text-emerald-700">
                                                        AED {Number(order.total || 0).toLocaleString()}
                                                    </span>
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {order.customerName}
                                                    {order.itemCount ? ` · ${order.itemCount} item${order.itemCount === 1 ? '' : 's'}` : ''}
                                                </p>
                                            </Link>
                                        ))
                                    ) : (
                                        <p className="px-4 py-6 text-sm text-slate-500">No new orders yet.</p>
                                    )}
                                </div>
                                <div className="border-t border-slate-100 px-4 py-3">
                                    <Link
                                        href="/store/orders"
                                        onClick={() => setShowNotifications(false)}
                                        className="text-sm font-semibold text-slate-800 hover:text-slate-950"
                                    >
                                        Open orders page →
                                    </Link>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
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
