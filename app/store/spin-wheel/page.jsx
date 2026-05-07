"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/useAuth";

const defaultSlices = [
  {
    label: "10% Off",
    color: "#6366f1",
    weight: 30,
    rewardType: "coupon_percent",
    discountValue: 10,
    minOrderValue: 0,
    expiryHours: 48,
  },
  {
    label: "Free Shipping",
    color: "#22c55e",
    weight: 10,
    rewardType: "free_shipping",
    discountValue: 0,
    minOrderValue: 0,
    expiryHours: 48,
  },
  {
    label: "AED 50 Off",
    color: "#f59e0b",
    weight: 20,
    rewardType: "coupon_flat",
    discountValue: 50,
    minOrderValue: 300,
    expiryHours: 48,
  },
  {
    label: "Better Luck",
    color: "#94a3b8",
    weight: 40,
    rewardType: "no_win",
    discountValue: 0,
    minOrderValue: 0,
    expiryHours: 48,
  },
];

export default function StoreSpinWheelPage() {
  const { getToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [form, setForm] = useState({
    isEnabled: false,
    campaignName: "Spin & Win",
    couponPrefix: "SPIN",
    dailySpinLimit: 1,
    spinInterval: "daily",
    homePageOnly: false,
    showAfterSeconds: 0,
    slices: defaultSlices,
  });

  const totalWeight = useMemo(
    () => form.slices.reduce((sum, s) => sum + Number(s.weight || 0), 0),
    [form.slices]
  );

  const fetchCampaign = async () => {
    setLoading(true);
    setMessage("");
    try {
      const token = await getToken();
      const res = await fetch("/api/store/spin-campaign", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || "Failed to fetch campaign");
        return;
      }
      if (data?.campaign) {
        setForm({
          isEnabled: Boolean(data.campaign.isEnabled),
          campaignName: data.campaign.campaignName || "Spin & Win",
          couponPrefix: data.campaign.couponPrefix || "SPIN",
          dailySpinLimit: Number(data.campaign.dailySpinLimit || 1),
          spinInterval: data.campaign.spinInterval || "daily",
          homePageOnly: Boolean(data.campaign.homePageOnly),
          showAfterSeconds: Number(data.campaign.showAfterSeconds || 0),
          slices: Array.isArray(data.campaign.slices) && data.campaign.slices.length
            ? data.campaign.slices
            : defaultSlices,
        });
        setHasSaved(true);
        setEditing(false);
      }
    } catch (error) {
      console.error("Failed to fetch spin campaign:", error);
      setMessage("Failed to fetch campaign");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
  }, []);

  const updateSlice = (index, field, value) => {
    setForm((prev) => {
      const slices = [...prev.slices];
      slices[index] = { ...slices[index], [field]: value };
      return { ...prev, slices };
    });
  };

  const addSlice = () => {
    setForm((prev) => ({
      ...prev,
      slices: [
        ...prev.slices,
        {
          label: "New Reward",
          color: "#3b82f6",
          weight: 10,
          rewardType: "coupon_percent",
          discountValue: 5,
          minOrderValue: 0,
          expiryHours: 48,
        },
      ],
    }));
  };

  const removeSlice = (index) => {
    setForm((prev) => ({
      ...prev,
      slices: prev.slices.filter((_, i) => i !== index),
    }));
  };

  const saveCampaign = async () => {
    setSaving(true);
    setMessage("");
    try {
      const token = await getToken();
      const res = await fetch("/api/store/spin-campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || "Failed to save campaign");
        return;
      }
      setMessage("Spin campaign saved successfully.");
      setHasSaved(true);
      setEditing(false);
      await fetchCampaign();
    } catch (error) {
      console.error("Failed to save spin campaign:", error);
      setMessage("Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Summary view — shown after a campaign is saved
  if (hasSaved && !editing) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Spin Wheel Campaign</h1>
            <p className="text-sm text-slate-500 mt-1">Your campaign is configured.</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600"
          >
            Edit Campaign
          </button>
        </div>

        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Status</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${form.isEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {form.isEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Campaign Name</span>
            <span className="text-sm font-medium text-slate-800">{form.campaignName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Coupon Prefix</span>
            <span className="text-sm font-medium text-slate-800">{form.couponPrefix}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Daily Limit</span>
            <span className="text-sm font-medium text-slate-800">{form.dailySpinLimit} spin(s)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Spin Interval</span>
            <span className="text-sm font-medium text-slate-800 capitalize">{form.spinInterval}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Home Page Only</span>
            <span className="text-sm font-medium text-slate-800">{form.homePageOnly ? "Yes" : "No"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Show After</span>
            <span className="text-sm font-medium text-slate-800">{form.showAfterSeconds}s</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Wheel Slices</span>
            <span className="text-sm font-medium text-slate-800">{form.slices.length} slice(s)</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Spin Wheel Campaign</h1>
          <p className="text-sm text-slate-600">Configure rewards, probability weights, and enable or disable the campaign.</p>
        </div>
        <div className="flex items-center gap-3">
          {hasSaved && (
            <button
              type="button"
              onClick={() => { setEditing(false); setMessage(""); }}
              className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={saveCampaign}
            disabled={saving}
            className="px-5 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Campaign"}
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">Campaign Status</label>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, isEnabled: !prev.isEnabled }))}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                form.isEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {form.isEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Campaign Name</label>
            <input
              value={form.campaignName}
              onChange={(e) => setForm((prev) => ({ ...prev, campaignName: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Coupon Prefix</label>
              <input
                value={form.couponPrefix}
                onChange={(e) => setForm((prev) => ({ ...prev, couponPrefix: e.target.value.toUpperCase() }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Daily Limit</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.dailySpinLimit}
                onChange={(e) => setForm((prev) => ({ ...prev, dailySpinLimit: Number(e.target.value || 1) }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Spin Time Interval</label>
              <select
                value={form.spinInterval}
                onChange={(e) => setForm((prev) => ({ ...prev, spinInterval: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Show After (seconds)</label>
              <input
                type="number"
                min={0}
                max={300}
                value={form.showAfterSeconds}
                onChange={(e) => setForm((prev) => ({ ...prev, showAfterSeconds: Number(e.target.value || 0) }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="0"
              />
              <p className="text-xs text-slate-500 mt-1">Delay before wheel appears (0 = immediate)</p>
            </div>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-3 w-full cursor-pointer">
              <input
                type="checkbox"
                checked={form.homePageOnly}
                onChange={(e) => setForm((prev) => ({ ...prev, homePageOnly: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span className="text-xs font-semibold uppercase text-slate-500">Home Page Only</span>
            </label>
          </div>

          <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 text-sm text-orange-700">
            Total weight: <span className="font-bold">{totalWeight}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Reward Types</h2>
          <ul className="text-sm text-slate-600 space-y-2">
            <li><span className="font-semibold">coupon_percent:</span> % discount coupon</li>
            <li><span className="font-semibold">coupon_flat:</span> fixed AED discount coupon</li>
            <li><span className="font-semibold">free_shipping:</span> free shipping coupon</li>
            <li><span className="font-semibold">no_win:</span> no reward</li>
          </ul>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Wheel Slices</h2>
          <button
            type="button"
            onClick={addSlice}
            className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200"
          >
            Add Slice
          </button>
        </div>

        <div className="space-y-3">
          {form.slices.map((slice, index) => (
            <div key={`${index}-${slice.label}`} className="border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
              <input
                value={slice.label}
                onChange={(e) => updateSlice(index, "label", e.target.value)}
                placeholder="Label"
                className="rounded-lg border border-slate-200 px-3 py-2"
              />

              <input
                type="color"
                value={slice.color || "#6366f1"}
                onChange={(e) => updateSlice(index, "color", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200"
              />

              <input
                type="number"
                min={1}
                value={slice.weight}
                onChange={(e) => updateSlice(index, "weight", Number(e.target.value || 1))}
                placeholder="Weight"
                className="rounded-lg border border-slate-200 px-3 py-2"
              />

              <select
                value={slice.rewardType}
                onChange={(e) => updateSlice(index, "rewardType", e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="coupon_percent">coupon_percent</option>
                <option value="coupon_flat">coupon_flat</option>
                <option value="free_shipping">free_shipping</option>
                <option value="no_win">no_win</option>
              </select>

              <input
                type="number"
                min={0}
                value={slice.discountValue}
                onChange={(e) => updateSlice(index, "discountValue", Number(e.target.value || 0))}
                placeholder="Discount"
                className="rounded-lg border border-slate-200 px-3 py-2"
              />

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={slice.minOrderValue}
                  onChange={(e) => updateSlice(index, "minOrderValue", Number(e.target.value || 0))}
                  placeholder="Min Order"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
                <input
                  type="number"
                  min={1}
                  value={slice.expiryHours}
                  onChange={(e) => updateSlice(index, "expiryHours", Number(e.target.value || 48))}
                  placeholder="Expiry(h)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => removeSlice(index)}
                  className="px-3 py-2 rounded-lg bg-red-50 text-red-600 font-semibold hover:bg-red-100"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
