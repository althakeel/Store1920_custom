"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/lib/useAuth";

const createBannerSliderItem = (prefix = 'banner-slider', overrides = {}) => ({
    id: overrides.id || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    image: overrides.image || "",
    link: overrides.link || "/shop",
    alt: overrides.alt || "",
});

const initialForm = {
    mainBannerEnabled: true,
    mainBannerImage: "",
    mainBannerTitle: "Power up instantly no battery needed",
    mainBannerTitleEnabled: true,
    mainBannerSubtitle: "Never stress over a dead battery again",
    mainBannerSubtitleEnabled: true,
    mainBannerCtaText: "Order Now",
    mainBannerCtaEnabled: true,
    mainBannerLink: "/shop",
    mainBannerLeftColor: "#00112b",
    mainBannerRightColor: "#00112b",
    mainBannerTitleColor: "#ffffff",
    mainBannerSubtitleColor: "#e5e7eb",
    mainBannerCtaBgColor: "#ef2d2d",
    mainBannerCtaTextColor: "#ffffff",
    bannerSliderEnabled: true,
    bannerSliderDesktopInterval: 4000,
    bannerSliderMobileInterval: 3000,
    bannerSliderDesktopHeight: 220,
    bannerSliderMobileHeight: 120,
    bannerSliderItems: [
        createBannerSliderItem("banner-slider", { id: "banner-slider-1", link: "/category/sofas", alt: "Banner 1" }),
        createBannerSliderItem("banner-slider", { id: "banner-slider-2", link: "/category/beds", alt: "Banner 2" }),
    ],
    secondaryBannerSliderEnabled: true,
    secondaryBannerSliderDesktopInterval: 4000,
    secondaryBannerSliderMobileInterval: 3000,
    secondaryBannerSliderDesktopHeight: 220,
    secondaryBannerSliderMobileHeight: 120,
    secondaryBannerSliderItems: [
        createBannerSliderItem("secondary-banner-slider", { id: "secondary-banner-slider-1", link: "/shop", alt: "Lower Banner 1" }),
        createBannerSliderItem("secondary-banner-slider", { id: "secondary-banner-slider-2", link: "/shop", alt: "Lower Banner 2" }),
    ],
};

export default function CarouselSliderPage() {
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState("");
    const [form, setForm] = useState(initialForm);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const token = await getToken();
                const response = await axios.get("/api/store/preferences/shop-showcase", {
                    headers: { Authorization: `Bearer ${token}` },
                });

                setForm((prev) => ({
                    ...prev,
                    ...(response.data?.shopShowcase || {}),
                    bannerSliderItems: Array.isArray(response.data?.shopShowcase?.bannerSliderItems) && response.data.shopShowcase.bannerSliderItems.length
                        ? response.data.shopShowcase.bannerSliderItems.map((item) => createBannerSliderItem("banner-slider", item))
                        : prev.bannerSliderItems,
                    secondaryBannerSliderItems: Array.isArray(response.data?.shopShowcase?.secondaryBannerSliderItems) && response.data.shopShowcase.secondaryBannerSliderItems.length
                        ? response.data.shopShowcase.secondaryBannerSliderItems.map((item) => createBannerSliderItem("secondary-banner-slider", item))
                        : prev.secondaryBannerSliderItems,
                }));
            } catch (error) {
                setMessage(error?.response?.data?.error || "Failed to load banner settings");
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, [getToken]);

    const updateField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const updateBannerSliderItem = (index, key, value) => {
        setForm((prev) => ({
            ...prev,
            bannerSliderItems: prev.bannerSliderItems.map((item, itemIndex) => (
                itemIndex === index ? { ...item, [key]: value } : item
            )),
        }));
    };

    const updateSecondaryBannerSliderItem = (index, key, value) => {
        setForm((prev) => ({
            ...prev,
            secondaryBannerSliderItems: prev.secondaryBannerSliderItems.map((item, itemIndex) => (
                itemIndex === index ? { ...item, [key]: value } : item
            )),
        }));
    };

    const addBannerSliderItem = () => {
        setForm((prev) => {
            if (prev.bannerSliderItems.length >= 6) return prev;

            return {
                ...prev,
                bannerSliderItems: [
                    ...prev.bannerSliderItems,
                        createBannerSliderItem("banner-slider", { alt: `Banner ${prev.bannerSliderItems.length + 1}` }),
                ],
            };
        });
    };

    const addSecondaryBannerSliderItem = () => {
        setForm((prev) => {
            if (prev.secondaryBannerSliderItems.length >= 6) return prev;

            return {
                ...prev,
                secondaryBannerSliderItems: [
                    ...prev.secondaryBannerSliderItems,
                    createBannerSliderItem("secondary-banner-slider", { alt: `Lower Banner ${prev.secondaryBannerSliderItems.length + 1}` }),
                ],
            };
        });
    };

    const removeBannerSliderItem = (index) => {
        setForm((prev) => ({
            ...prev,
            bannerSliderItems: prev.bannerSliderItems.filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    const removeSecondaryBannerSliderItem = (index) => {
        setForm((prev) => ({
            ...prev,
            secondaryBannerSliderItems: prev.secondaryBannerSliderItems.filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    const uploadBanner = async (file) => {
        if (!file) return;

        try {
            setUploading(true);
            setMessage("");

            const token = await getToken();
            const formData = new FormData();
            formData.append("image", file);
            formData.append("type", "banner");

            const response = await axios.post("/api/store/upload-image", formData, {
                headers: { Authorization: `Bearer ${token}` },
            });

            updateField("mainBannerImage", response.data?.url || "");
            setMessage("Banner uploaded successfully.");
        } catch (error) {
            setMessage(error?.response?.data?.error || "Banner upload failed");
        } finally {
            setUploading(false);
        }
    };

    const uploadBannerSliderImage = async (index, file) => {
        if (!file) return;

        try {
            setUploading(true);
            setMessage("");

            const token = await getToken();
            const formData = new FormData();
            formData.append("image", file);
            formData.append("type", "banner");

            const response = await axios.post("/api/store/upload-image", formData, {
                headers: { Authorization: `Bearer ${token}` },
            });

            updateBannerSliderItem(index, "image", response.data?.url || "");
            setMessage("Slider banner uploaded successfully.");
        } catch (error) {
            setMessage(error?.response?.data?.error || "Slider banner upload failed");
        } finally {
            setUploading(false);
        }
    };

    const uploadSecondaryBannerSliderImage = async (index, file) => {
        if (!file) return;

        try {
            setUploading(true);
            setMessage("");

            const token = await getToken();
            const formData = new FormData();
            formData.append("image", file);
            formData.append("type", "banner");

            const response = await axios.post("/api/store/upload-image", formData, {
                headers: { Authorization: `Bearer ${token}` },
            });

            updateSecondaryBannerSliderItem(index, "image", response.data?.url || "");
            setMessage("Lower banner uploaded successfully.");
        } catch (error) {
            setMessage(error?.response?.data?.error || "Lower banner upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async (event) => {
        event.preventDefault();
        setSaving(true);
        setMessage("");

        try {
            const token = await getToken();
            await axios.put("/api/store/preferences/shop-showcase", form, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setMessage("Hero banner settings saved successfully.");
        } catch (error) {
            setMessage(error?.response?.data?.error || "Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            <div className="border-b border-slate-200 bg-white px-6 py-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold text-slate-900">Homepage Banners</h2>
                        <p className="text-sm text-slate-500">Manage the hero banner and the lower homepage banner slider from one place.</p>
                    </div>
                    <a
                        href="/store/carousel-slider"
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Manage Slider Products
                    </a>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                        Loading banner settings...
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                        <div className="space-y-6">
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h3 className="font-semibold text-slate-900">Enable Hero Banner</h3>
                                        <p className="text-sm text-slate-500">Turn the dynamic homepage hero banner on or off.</p>
                                    </div>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            checked={form.mainBannerEnabled}
                                            onChange={(e) => updateField("mainBannerEnabled", e.target.checked)}
                                            className="peer sr-only"
                                        />
                                        <div className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full" />
                                    </label>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-slate-700">Banner image</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => uploadBanner(e.target.files?.[0])}
                                        className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                                    />
                                    <p className="text-xs text-slate-500">Upload a wide banner image. If no image is uploaded, the banner falls back to the gradient background and text.</p>
                                    {form.mainBannerImage ? (
                                        <img
                                            src={form.mainBannerImage}
                                            alt="Hero banner preview"
                                            className="h-40 w-full rounded-xl border border-slate-200 object-cover"
                                        />
                                    ) : null}
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className="space-y-2 md:col-span-2">
                                        <span className="block text-sm font-medium text-slate-700">Headline</span>
                                        <span className="flex items-center gap-3 text-xs text-slate-500">
                                            <input
                                                type="checkbox"
                                                checked={form.mainBannerTitleEnabled}
                                                onChange={(e) => updateField("mainBannerTitleEnabled", e.target.checked)}
                                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            Show headline
                                        </span>
                                        <input
                                            type="text"
                                            value={form.mainBannerTitle}
                                            onChange={(e) => updateField("mainBannerTitle", e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </label>
                                    <label className="space-y-2 md:col-span-2">
                                        <span className="block text-sm font-medium text-slate-700">Subheadline</span>
                                        <span className="flex items-center gap-3 text-xs text-slate-500">
                                            <input
                                                type="checkbox"
                                                checked={form.mainBannerSubtitleEnabled}
                                                onChange={(e) => updateField("mainBannerSubtitleEnabled", e.target.checked)}
                                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            Show subheadline
                                        </span>
                                        <textarea
                                            value={form.mainBannerSubtitle}
                                            onChange={(e) => updateField("mainBannerSubtitle", e.target.value)}
                                            rows={3}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="block text-sm font-medium text-slate-700">Button text</span>
                                        <span className="flex items-center gap-3 text-xs text-slate-500">
                                            <input
                                                type="checkbox"
                                                checked={form.mainBannerCtaEnabled}
                                                onChange={(e) => updateField("mainBannerCtaEnabled", e.target.checked)}
                                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            Show button
                                        </span>
                                        <input
                                            type="text"
                                            value={form.mainBannerCtaText}
                                            onChange={(e) => updateField("mainBannerCtaText", e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="block text-sm font-medium text-slate-700">Button link</span>
                                        <input
                                            type="text"
                                            value={form.mainBannerLink}
                                            onChange={(e) => updateField("mainBannerLink", e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
                                <div>
                                    <h3 className="font-semibold text-slate-900">Banner Colors</h3>
                                    <p className="mt-1 text-sm text-slate-500">These colors are used on the homepage hero banner preview and live storefront.</p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    {[
                                        ["mainBannerLeftColor", "Left background"],
                                        ["mainBannerRightColor", "Right background"],
                                        ["mainBannerTitleColor", "Title text"],
                                        ["mainBannerSubtitleColor", "Subtitle text"],
                                        ["mainBannerCtaBgColor", "Button background"],
                                        ["mainBannerCtaTextColor", "Button text"],
                                    ].map(([key, label]) => (
                                        <label key={key} className="space-y-2">
                                            <span className="block text-sm font-medium text-slate-700">{label}</span>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="color"
                                                    value={form[key] || "#000000"}
                                                    onChange={(e) => updateField(key, e.target.value)}
                                                    className="h-11 w-14 rounded border border-slate-300 bg-white p-1"
                                                />
                                                <input
                                                    type="text"
                                                    value={form[key] || ""}
                                                    onChange={(e) => updateField(key, e.target.value)}
                                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm focus:border-emerald-500 focus:outline-none"
                                                />
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h3 className="font-semibold text-slate-900">Lower Banner Slider</h3>
                                        <p className="mt-1 text-sm text-slate-500">This controls the banner slider that appears below the top hero banner on the homepage.</p>
                                    </div>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            checked={form.bannerSliderEnabled}
                                            onChange={(e) => updateField("bannerSliderEnabled", e.target.checked)}
                                            className="peer sr-only"
                                        />
                                        <div className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full" />
                                    </label>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className="space-y-2">
                                        <span className="block text-sm font-medium text-slate-700">Desktop slide speed (ms)</span>
                                        <input
                                            type="number"
                                            min="1500"
                                            step="100"
                                            value={form.bannerSliderDesktopInterval}
                                            onChange={(e) => updateField("bannerSliderDesktopInterval", Number(e.target.value) || 4000)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="block text-sm font-medium text-slate-700">Mobile slide speed (ms)</span>
                                        <input
                                            type="number"
                                            min="1500"
                                            step="100"
                                            value={form.bannerSliderMobileInterval}
                                            onChange={(e) => updateField("bannerSliderMobileInterval", Number(e.target.value) || 3000)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="block text-sm font-medium text-slate-700">Desktop banner height (px)</span>
                                        <input
                                            type="number"
                                            min="80"
                                            max="400"
                                            step="5"
                                            value={form.bannerSliderDesktopHeight}
                                            onChange={(e) => updateField("bannerSliderDesktopHeight", Number(e.target.value) || 220)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="block text-sm font-medium text-slate-700">Mobile banner height (px)</span>
                                        <input
                                            type="number"
                                            min="80"
                                            max="400"
                                            step="5"
                                            value={form.bannerSliderMobileHeight}
                                            onChange={(e) => updateField("bannerSliderMobileHeight", Number(e.target.value) || 120)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </label>
                                </div>

                                <div className="space-y-4">
                                    {form.bannerSliderItems.map((item, itemIndex) => (
                                        <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                                            <div className="mb-4 flex items-center justify-between gap-4">
                                                <div>
                                                    <h4 className="font-medium text-slate-900">Slide {itemIndex + 1}</h4>
                                                    <p className="text-sm text-slate-500">Upload an image and set the destination link for this banner.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeBannerSliderItem(itemIndex)}
                                                    disabled={form.bannerSliderItems.length <= 1}
                                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Remove
                                                </button>
                                            </div>

                                            <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
                                                <div className="space-y-3">
                                                    <label className="block text-sm font-medium text-slate-700">Banner image</label>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => uploadBannerSliderImage(itemIndex, e.target.files?.[0])}
                                                        className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                                                    />
                                                    {item.image ? (
                                                        <img
                                                            src={item.image}
                                                            alt={item.alt || `Slider banner ${itemIndex + 1}`}
                                                            className="h-36 w-full rounded-xl border border-slate-200 object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                                                            Uploaded image preview appears here
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="grid gap-4 content-start">
                                                    <label className="space-y-2">
                                                        <span className="block text-sm font-medium text-slate-700">Alt text</span>
                                                        <input
                                                            type="text"
                                                            value={item.alt}
                                                            onChange={(e) => updateBannerSliderItem(itemIndex, "alt", e.target.value)}
                                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                                        />
                                                    </label>
                                                    <label className="space-y-2">
                                                        <span className="block text-sm font-medium text-slate-700">Link</span>
                                                        <input
                                                            type="text"
                                                            value={item.link}
                                                            onChange={(e) => updateBannerSliderItem(itemIndex, "link", e.target.value)}
                                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={addBannerSliderItem}
                                    disabled={form.bannerSliderItems.length >= 6}
                                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Add Slide
                                </button>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h3 className="font-semibold text-slate-900">Second Lower Banner Slider</h3>
                                        <p className="mt-1 text-sm text-slate-500">This is the separate banner slider shown in the extra section lower on the homepage.</p>
                                    </div>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            checked={form.secondaryBannerSliderEnabled}
                                            onChange={(e) => updateField("secondaryBannerSliderEnabled", e.target.checked)}
                                            className="peer sr-only"
                                        />
                                        <div className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full" />
                                    </label>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className="space-y-2">
                                        <span className="block text-sm font-medium text-slate-700">Desktop slide speed (ms)</span>
                                        <input
                                            type="number"
                                            min="1500"
                                            step="100"
                                            value={form.secondaryBannerSliderDesktopInterval}
                                            onChange={(e) => updateField("secondaryBannerSliderDesktopInterval", Number(e.target.value) || 4000)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="block text-sm font-medium text-slate-700">Mobile slide speed (ms)</span>
                                        <input
                                            type="number"
                                            min="1500"
                                            step="100"
                                            value={form.secondaryBannerSliderMobileInterval}
                                            onChange={(e) => updateField("secondaryBannerSliderMobileInterval", Number(e.target.value) || 3000)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="block text-sm font-medium text-slate-700">Desktop banner height (px)</span>
                                        <input
                                            type="number"
                                            min="80"
                                            max="400"
                                            step="5"
                                            value={form.secondaryBannerSliderDesktopHeight}
                                            onChange={(e) => updateField("secondaryBannerSliderDesktopHeight", Number(e.target.value) || 220)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="block text-sm font-medium text-slate-700">Mobile banner height (px)</span>
                                        <input
                                            type="number"
                                            min="80"
                                            max="400"
                                            step="5"
                                            value={form.secondaryBannerSliderMobileHeight}
                                            onChange={(e) => updateField("secondaryBannerSliderMobileHeight", Number(e.target.value) || 120)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </label>
                                </div>

                                <div className="space-y-4">
                                    {form.secondaryBannerSliderItems.map((item, itemIndex) => (
                                        <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                                            <div className="mb-4 flex items-center justify-between gap-4">
                                                <div>
                                                    <h4 className="font-medium text-slate-900">Slide {itemIndex + 1}</h4>
                                                    <p className="text-sm text-slate-500">Upload an image and set the destination link for this lower banner.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeSecondaryBannerSliderItem(itemIndex)}
                                                    disabled={form.secondaryBannerSliderItems.length <= 1}
                                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Remove
                                                </button>
                                            </div>

                                            <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
                                                <div className="space-y-3">
                                                    <label className="block text-sm font-medium text-slate-700">Banner image</label>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => uploadSecondaryBannerSliderImage(itemIndex, e.target.files?.[0])}
                                                        className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                                                    />
                                                    {item.image ? (
                                                        <img
                                                            src={item.image}
                                                            alt={item.alt || `Lower banner ${itemIndex + 1}`}
                                                            className="h-36 w-full rounded-xl border border-slate-200 object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                                                            Uploaded image preview appears here
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="grid gap-4 content-start">
                                                    <label className="space-y-2">
                                                        <span className="block text-sm font-medium text-slate-700">Alt text</span>
                                                        <input
                                                            type="text"
                                                            value={item.alt}
                                                            onChange={(e) => updateSecondaryBannerSliderItem(itemIndex, "alt", e.target.value)}
                                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                                        />
                                                    </label>
                                                    <label className="space-y-2">
                                                        <span className="block text-sm font-medium text-slate-700">Link</span>
                                                        <input
                                                            type="text"
                                                            value={item.link}
                                                            onChange={(e) => updateSecondaryBannerSliderItem(itemIndex, "link", e.target.value)}
                                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={addSecondaryBannerSliderItem}
                                    disabled={form.secondaryBannerSliderItems.length >= 6}
                                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Add Slide
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 sticky top-6">
                                <div>
                                    <h3 className="font-semibold text-slate-900">Live Preview</h3>
                                    <p className="mt-1 text-sm text-slate-500">Approximate preview of the homepage hero banner.</p>
                                </div>

                                <div
                                    className="overflow-hidden rounded-2xl border border-slate-200"
                                    style={{
                                        background: `linear-gradient(90deg, ${form.mainBannerLeftColor} 0%, ${form.mainBannerRightColor} 100%)`,
                                    }}
                                >
                                    <div className="grid min-h-[280px] gap-4 p-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
                                        <div className="max-w-md">
                                            {form.mainBannerTitleEnabled ? (
                                                <p
                                                    className="text-3xl font-extrabold leading-tight"
                                                    style={{ color: form.mainBannerTitleColor }}
                                                >
                                                    {form.mainBannerTitle}
                                                </p>
                                            ) : null}
                                            {form.mainBannerSubtitleEnabled ? (
                                                <p
                                                    className={`${form.mainBannerTitleEnabled ? 'mt-3' : ''} text-sm leading-6`}
                                                    style={{ color: form.mainBannerSubtitleColor }}
                                                >
                                                    {form.mainBannerSubtitle}
                                                </p>
                                            ) : null}
                                            {form.mainBannerCtaEnabled ? (
                                                <button
                                                    type="button"
                                                    className="mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold"
                                                    style={{
                                                        backgroundColor: form.mainBannerCtaBgColor,
                                                        color: form.mainBannerCtaTextColor,
                                                    }}
                                                >
                                                    {form.mainBannerCtaText}
                                                </button>
                                            ) : null}
                                        </div>

                                        <div className="relative min-h-[180px] overflow-hidden rounded-xl bg-white/10">
                                            {form.mainBannerImage ? (
                                                <img
                                                    src={form.mainBannerImage}
                                                    alt="Banner artwork"
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center text-sm text-white/80">
                                                    Uploaded image preview appears here
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                                    <p className="font-medium text-slate-800">Current link</p>
                                    <p className="mt-1 break-all">{form.mainBannerLink || "/shop"}</p>
                                </div>

                                <div className="rounded-xl border border-slate-200 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="font-medium text-slate-900">Lower slider summary</p>
                                            <p className="mt-1 text-sm text-slate-500">{form.bannerSliderEnabled ? `${form.bannerSliderItems.length} slides active` : "Slider disabled"}</p>
                                        </div>
                                        <div className="text-right text-xs text-slate-500">
                                            <div>Desktop: {form.bannerSliderDesktopInterval}ms</div>
                                            <div>Mobile: {form.bannerSliderMobileInterval}ms</div>
                                            <div>Height: {form.bannerSliderDesktopHeight}px / {form.bannerSliderMobileHeight}px</div>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-3">
                                        {form.bannerSliderItems.map((item, itemIndex) => (
                                            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                                                <div className="flex h-14 w-20 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                                                    {item.image ? (
                                                        <img
                                                            src={item.image}
                                                            alt={item.alt || `Slide ${itemIndex + 1}`}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-slate-500">No image</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-slate-800">{item.alt || `Slide ${itemIndex + 1}`}</p>
                                                    <p className="truncate text-xs text-slate-500">{item.link || "/shop"}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="font-medium text-slate-900">Second lower slider summary</p>
                                            <p className="mt-1 text-sm text-slate-500">{form.secondaryBannerSliderEnabled ? `${form.secondaryBannerSliderItems.length} slides active` : "Slider disabled"}</p>
                                        </div>
                                        <div className="text-right text-xs text-slate-500">
                                            <div>Desktop: {form.secondaryBannerSliderDesktopInterval}ms</div>
                                            <div>Mobile: {form.secondaryBannerSliderMobileInterval}ms</div>
                                            <div>Height: {form.secondaryBannerSliderDesktopHeight}px / {form.secondaryBannerSliderMobileHeight}px</div>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-3">
                                        {form.secondaryBannerSliderItems.map((item, itemIndex) => (
                                            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                                                <div className="flex h-14 w-20 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                                                    {item.image ? (
                                                        <img
                                                            src={item.image}
                                                            alt={item.alt || `Slide ${itemIndex + 1}`}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-slate-500">No image</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-slate-800">{item.alt || `Lower Banner ${itemIndex + 1}`}</p>
                                                    <p className="truncate text-xs text-slate-500">{item.link || "/shop"}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={saving || uploading}
                                    className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {uploading ? "Uploading image..." : saving ? "Saving..." : "Save Banner Settings"}
                                </button>

                                {message ? (
                                    <div className={`rounded-lg px-4 py-3 text-sm ${message.toLowerCase().includes("success") || message.toLowerCase().includes("saved") || message.toLowerCase().includes("uploaded") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                        {message}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}