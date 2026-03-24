'use client'
import Link from "next/link"
import Image from "next/image";
import Logo from "../../assets/logo/logo3.png";


import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

const AdminNavbar = () => {
    const [user, setUser] = useState(undefined); // undefined = loading, null = not logged in
    const router = useRouter();
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((u) => setUser(u));
        return () => unsubscribe();
    }, []);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleSignOut = async () => {
        try {
            await auth.signOut();
            router.push("/admin/sign-in");
        } catch (error) {
            console.error("Admin logout failed", error);
        } finally {
            setShowConfirm(false);
        }
    };
    if (user === undefined) {
        // Loading state: show nothing or a spinner if you want
        return null;
    }
    return (
        <div className="flex items-center justify-between px-12 py-3 border-b border-slate-200 transition-all">
            <Link href="/admin" className="relative text-4xl font-semibold text-slate-700">
                <Image
                    src={Logo}
                    alt="Brandstored Logo"
                    width={180}
                    height={48}
                    className="object-contain"
                    priority
                />
                <p className="absolute text-xs font-semibold -top-1 -right-13 px-3 p-0.5 rounded-full flex items-center gap-2 text-white bg-green-500">
               Brandstored
                </p>
            </Link>
            <div className="flex items-center gap-3">
                {user ? (
                    <>
                        <p>Hi, {user.displayName || user.email}</p>
                        <button onClick={() => setShowConfirm(true)} className="px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition">Sign Out</button>
                    </>
                ) : (
                    <p>Hi, Brandstored</p>
                )}
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
                            <h3 className="text-lg font-semibold text-slate-900 text-center">Sign out from admin?</h3>
                            <p className="mt-2 text-sm text-slate-600 text-center">You can log back in anytime to continue managing the store.</p>
                            <div className="mt-5 grid grid-cols-2 gap-3">
                                <button
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                                    onClick={() => setShowConfirm(false)}
                                >
                                    Stay
                                </button>
                                <button
                                    className="w-full rounded-xl bg-gradient-to-r from-red-500 to-orange-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200/50 hover:brightness-105 transition"
                                    onClick={handleSignOut}
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminNavbar