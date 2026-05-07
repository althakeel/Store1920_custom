"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

function buildConicGradient(slices) {
  let current = 0;
  const total = slices.reduce((sum, s) => sum + Number(s.weight || 0), 0) || 1;
  const stops = slices.map((slice) => {
    const part = (Number(slice.weight || 0) / total) * 100;
    const start = current;
    current += part;
    return `${slice.color || "#6366f1"} ${start}% ${current}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function getSliceCenterDegrees(slices, targetIndex) {
  const total = slices.reduce((sum, s) => sum + Number(s.weight || 0), 0) || 1;
  let acc = 0;
  for (let i = 0; i < slices.length; i += 1) {
    const segment = (Number(slices[i].weight || 0) / total) * 360;
    if (i === targetIndex) {
      return acc + segment / 2;
    }
    acc += segment;
  }
  return 0;
}

export default function SpinWheelWidget() {
  const pathname = usePathname();
  const { getToken, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const [result, setResult] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [rotation, setRotation] = useState(0);
  const [showLauncher, setShowLauncher] = useState(false);

  const hiddenByPath = ["/checkout", "/cart", "/order-success", "/order-failed"].some(
    (p) => pathname === p || pathname?.startsWith(p + "/")
  );

  useEffect(() => {
    let ignore = false;

    const loadCampaign = async () => {
      try {
        setLoading(true);
        // No storeId needed — API returns the first enabled campaign
        const res = await fetch(`/api/spin/campaign`);
        const data = await res.json();
        if (ignore) return;
        if (res.ok && data?.isEnabled && data?.campaign?.slices?.length) {
          setCampaign(data.campaign);
        } else {
          setCampaign(null);
        }
      } catch (err) {
        console.error("Spin campaign fetch failed:", err);
        if (!ignore) setCampaign(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    if (!hiddenByPath) {
      loadCampaign();
    }

    return () => {
      ignore = true;
    };
  }, [hiddenByPath]);

  useEffect(() => {
    if (!campaign || hiddenByPath) {
      setShowLauncher(false);
      return;
    }

    if (campaign.homePageOnly && pathname !== "/") {
      setShowLauncher(false);
      return;
    }

    const delayMs = Math.max(0, Number(campaign.showAfterSeconds || 0)) * 1000;
    if (!delayMs) {
      setShowLauncher(true);
      return;
    }

    setShowLauncher(false);
    const timer = setTimeout(() => setShowLauncher(true), delayMs);
    return () => clearTimeout(timer);
  }, [campaign, hiddenByPath, pathname]);

  const wheelBg = useMemo(() => {
    if (!campaign?.slices?.length) return "#e2e8f0";
    return buildConicGradient(campaign.slices);
  }, [campaign]);

  const handlePlay = async () => {
    if (!campaign?.slices?.length || playing) return;

    setError("");
    setResult(null);

    const token = await getToken();
    if (!token) {
      setError("Please sign in first to spin and win rewards.");
      return;
    }

    try {
      setPlaying(true);
      const res = await fetch("/api/spin/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: campaign.storeId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Unable to play spin right now.");
        return;
      }

      const idx = campaign.slices.findIndex((s) => s.label === data.sliceLabel);
      const targetIndex = idx >= 0 ? idx : 0;
      const centerDeg = getSliceCenterDegrees(campaign.slices, targetIndex);
      const targetRotation = rotation + 5 * 360 + (360 - centerDeg);

      setRotation(targetRotation);
      setResult(data);
    } catch (err) {
      console.error("Spin play failed:", err);
      setError("Unable to play spin right now.");
    } finally {
      setPlaying(false);
    }
  };

  if (loading || hiddenByPath || !campaign?.slices?.length || !showLauncher) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-[95] px-4 py-3 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold shadow-xl hover:from-orange-600 hover:to-red-600 transition"
      >
        Spin & Win
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{campaign.campaignName || "Spin & Win"}</h3>
                <p className="text-xs text-slate-500">Daily limit: {campaign.dailySpinLimit} spin(s)</p>
              </div>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="p-6">
              <div className="relative mx-auto w-72 h-72">
                <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-0 border-b-[18px] border-b-orange-600 z-20" />
                <div
                  className="w-72 h-72 rounded-full border-[10px] border-white shadow-lg"
                  style={{
                    background: wheelBg,
                    transform: `rotate(${rotation}deg)`,
                    transition: playing ? "transform 4s cubic-bezier(0.22, 1, 0.36, 1)" : "transform 0.3s ease",
                  }}
                />
                <div className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-white border-4 border-orange-400 flex items-center justify-center font-black text-orange-500">
                  GO
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                {campaign.slices.map((slice) => (
                  <div key={`${slice.label}-${slice.rewardType}`} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-md p-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }} />
                    <span className="text-slate-700 font-medium truncate">{slice.label}</span>
                  </div>
                ))}
              </div>

              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

              {result && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm font-semibold text-emerald-800">{result.message}</p>
                  {result.couponCode && (
                    <div className="mt-2 flex items-center justify-between gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-2">
                      <span className="font-mono font-bold text-emerald-700">{result.couponCode}</span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                        onClick={() => navigator.clipboard?.writeText(result.couponCode)}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handlePlay}
                disabled={playing}
                className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold hover:from-orange-600 hover:to-red-600 disabled:opacity-60"
              >
                {playing ? "Spinning..." : user ? "Spin Now" : "Sign in to Spin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
