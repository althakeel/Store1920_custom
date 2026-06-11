"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import Banner1 from '../assets/banner4/Mini Banner 1.webp'


const HomeDealsSection = ({ sections }) => {
  // Banner logic (optional, fallback to static if not present)
  const [currentBanner, setCurrentBanner] = useState(0);
  const [bannerImages, setBannerImages] = useState([Banner1]);
  const [bannerMeta, setBannerMeta] = useState({ title: 'Shop your fashion needs', subtitle: 'With latest & trendy choices', ctaText: 'Shop Now', ctaLink: '/shop' });

  useEffect(() => {
    // If you want to support dynamic banners, you can pass them as a prop or fetch here
    // For now, fallback to static
    setBannerImages([Banner1]);
    setBannerMeta({ title: 'Shop your fashion needs', subtitle: 'With latest & trendy choices', ctaText: 'Shop Now', ctaLink: '/shop' });
  }, []);

  useEffect(() => {
    if (!bannerImages.length) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % bannerImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [bannerImages.length]);

  // Only show the first two sections in the top row
  return (
    <section className="max-w-7xl mx-auto px-4 my-12 hidden xl:block">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 items-stretch">
        {/* LEFT TWO — Deal Sections (only first two, never duplicated below) */}
        {(sections || []).slice(0,2).map((section, index) => (
          section && section.products && section.products.length > 0 && section.title ? (
            <div key={index} className="bg-white rounded-[2px] shadow-md border border-gray-100 p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-semibold text-gray-800 text-lg">{section.title}</h2>
                <button className="text-blue-500 text-sm hover:underline">›</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {section.products.slice(0,4).map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 p-2 rounded-[2px] hover:shadow transition-all flex flex-col items-center text-center"
                  >
                    <Image
                      src={item.images && item.images[0] ? item.images[0] : ''}
                      alt={item.name}
                      width={300}
                      height={300}
                      className="rounded-[2px] w-full h-32 object-contain"
                    />
                    <p className="text-sm font-medium mt-1 text-gray-700">{item.name && item.name.length > 25 ? item.name.slice(0, 25) + '…' : item.name}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        ))}

        {/* RIGHT SIDE — Rotating Banner */}
        <div className="relative rounded-2xl overflow-hidden flex items-center justify-center bg-gray-100 min-h-[450px]">
          {bannerImages.map((img, index) => (
            <Image
              key={index}
              src={img}
              alt="Shop your fashion needs"
              fill
              className={`object-cover absolute inset-0 transition-opacity duration-1000 ${
                currentBanner === index ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}

          {/* Overlay text content */}
          <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-white text-center p-6">
            <h3 className="text-2xl font-semibold mb-2">{bannerMeta.title}</h3>
            {bannerMeta.subtitle && <p className="text-sm mb-4">{bannerMeta.subtitle}</p>}
            <Link
              href={bannerMeta.ctaLink}
              className="bg-white text-black px-4 py-2 rounded-full font-medium hover:bg-gray-200 transition"
            >
              {bannerMeta.ctaText}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeDealsSection;
