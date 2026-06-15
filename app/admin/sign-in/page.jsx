"use client";
import { useState } from "react";
import { getAuthErrorMessage, signInWithGooglePopup } from "@/lib/firebaseAuthActions";
import { useRouter } from "next/navigation";

export default function AdminSignIn() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSignIn = async () => {
        setLoading(true);
        setError("");
        try {
            await signInWithGooglePopup();
            router.push("/admin");
        } catch (err) {
            setError(getAuthErrorMessage(err, "Sign in failed"));
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white">
            <div className="bg-white p-8 rounded shadow-md w-full max-w-sm flex flex-col items-center">
                <h1 className="text-2xl font-bold mb-6">Admin Login</h1>
                <button
                    onClick={handleSignIn}
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition mb-4"
                    disabled={loading}
                >
                    {loading ? "Signing in..." : "Sign in with Google"}
                </button>
                {error && <div className="text-red-500 text-center mt-2">{error}</div>}
            </div>
        </div>
    );
}
