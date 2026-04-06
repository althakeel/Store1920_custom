'use client';

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function HomeCategories() {
  const scrollRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const CACHE_KEY = 'homeMenuCategoriesCache_v2'; // Changed cache key to bust old cache

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Clear old cache on mount
        const oldCache = localStorage.getItem('homeMenuCategoriesCache');
        if (oldCache) {
          localStorage.removeItem('homeMenuCategoriesCache');
        }
        
        // Check localStorage first for immediate display
        const cached = localStorage.getItem(CACHE_KEY);
        let cachedData = null;
        
        if (cached) {
          try {
            cachedData = JSON.parse(cached);
            if (Array.isArray(cachedData?.items) && cachedData.items.length > 0) {
              setCategories(cachedData.items);
              setError(null);
            }
          } catch (e) {
            console.error('Cache parse error:', e);
          }
        }
       
        
        const response = await fetch('/api/store/home-menu-categories', { cache: 'no-store' });

        if (response.ok) {
          const data = await response.json();
          
          if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            setCategories(data.items);
            
            // Try to save to localStorage, but handle quota exceeded gracefully
            try {
              const cacheData = { 
                items: data.items, 
                count: data.count || data.items.length, 
                updatedAt: Date.now() 
              };
              localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            } catch (storageErr) {
              if (storageErr.name === 'QuotaExceededError') {
                // Try to clear cache and retry
                try {
                  localStorage.removeItem(CACHE_KEY);
                  const cacheData = { 
                    items: data.items, 
                    count: data.count || data.items.length, 
                    updatedAt: Date.now() 
                  };
                  localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
                } catch (retryErr) {
                  // Could not save to localStorage even after clearing
                  // Continue without caching - data is already set in state
                }
              }
            }
            
            setError(null);
          } else {
            // API returned empty, use cache if available
            if (!cachedData || !cachedData.items || cachedData.items.length === 0) {
              setError('No categories available');
            }
          }
        } else {
          console.error('API response not ok:', response.status);
          // API call failed, use cached data if available
          if (!cachedData || !cachedData.items || cachedData.items.length === 0) {
            setError(`Failed to load categories (${response.status})`);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('HomeCategories error:', err);
        
        // Try to use cached data as fallback
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            if (Array.isArray(cachedData?.items) && cachedData.items.length > 0) {
              console.log('Using cached data due to error:', cachedData.items);
              setCategories(cachedData.items);
              setError(null);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error('Error parsing fallback cache:', e);
          }
        }
        
        setError(`Error: ${err.message}`);
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const scrollLeft = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: -200, behavior: "smooth" });
  };

  const scrollRight = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: 200, behavior: "smooth" });
  };

  // Determine the link for each category
  const getCategoryLink = (cat) => {
    // If custom URL is provided, use it
    if (cat.url) return cat.url;
    // If category ID is provided, navigate to shop with category
    if (cat.categoryId) return `/shop?category=${cat.categoryId}`;
    // Default fallback
    return '/shop';
  };

  // Fix ImageKit URLs by adding format transformation and default extension
  const fixImageKitUrl = (url) => {
    if (!url) return null;
    
    if (url.includes('ik.imagekit.io')) {
      if (!url.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
        if (url.includes('?')) {
          return url.replace('?', '.jpg?');
        } else {
          return `${url}.jpg?tr=f-auto,q-80`;
        }
      }
      if (!url.includes('?')) {
        return `${url}?tr=f-auto,q-80`;
      }
    }
    return url;
  };

  const getCategoryGradient = (name) => {
    const colors = [
      'from-blue-400 to-blue-600',
      'from-purple-400 to-purple-600',
      'from-pink-400 to-pink-600',
      'from-red-400 to-red-600',
      'from-orange-400 to-orange-600',
      'from-yellow-400 to-yellow-600',
      'from-green-400 to-green-600',
      'from-teal-400 to-teal-600',
    ];
    const hash = name.charCodeAt(0) % colors.length;
    return colors[hash];
  };

  if (loading && categories.length === 0) {
    return (
      <div className="relative w-full max-w-[1400px] mx-auto bg-white py-4 px-4 sm:px-6">
        <div className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide px-12 md:px-4 md:justify-between">
          {Array(10).fill(0).map((_, idx) => (
            <div key={idx} className="flex flex-col items-center flex-shrink-0 w-24 md:flex-1 p-2 md:p-3">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-gray-200 animate-pulse" />
              <div className="mt-2 h-3 bg-gray-200 rounded w-12 md:w-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show error if we have one and no categories
  if (error && categories.length === 0) {
    return (
      <div className="relative w-full max-w-[1400px] mx-auto bg-white py-4 px-4 sm:px-6">
        <div className="text-center py-8 text-gray-500 text-sm">
          {error}
        </div>
      </div>
    );
  }

  // Don't show anything if no categories (after loading and no error)
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="relative w-full max-w-[1400px] mx-auto bg-white py-4 px-4 sm:px-6">
      {/* Left Arrow */}
      <button
        className="md:hidden absolute left-2 top-1/2 -translate-y-1/2 bg-white shadow-md rounded-full p-2 z-10 hover:bg-gray-100 transition"
        onClick={scrollLeft}
      >
        <ChevronLeft size={20} />
      </button>

      {/* Scrollable Row */}
      <div
        ref={scrollRef}
        className="flex gap-4 md:gap-6 overflow-x-auto md:overflow-visible scrollbar-hide px-12 md:px-4 md:justify-between"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {categories.map((cat, idx) => (
          <Link
            key={`${cat.name}-${idx}`}
            href={getCategoryLink(cat)}
            className="flex flex-col items-center flex-shrink-0 w-24 md:flex-1 cursor-pointer hover:scale-105 transition-all duration-200 p-2 md:p-3"
            style={{ scrollSnapAlign: 'start' }}
          >
            <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden bg-gray-100">
              {cat.image ? (
                <>
                  <Image 
                    src={fixImageKitUrl(cat.image)} 
                    alt={cat.name}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      // Hide broken image, show gradient fallback
                      e.target.style.display = 'none';
                      const fallback = e.target.nextElementSibling;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                    unoptimized={true}
                  />
                  {/* Gradient fallback shown on image error */}
                  <div style={{ display: 'none' }} className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getCategoryGradient(cat.name)} text-white text-2xl font-bold`}>
                    {cat.name.charAt(0).toUpperCase()}
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 text-xs">
                  No image
                </div>
              )}
            </div>
            <span className="mt-2 text-[10px] sm:text-xs md:text-sm text-center font-medium line-clamp-2 leading-tight w-full">
              {cat.name}
            </span>
          </Link>
        ))}
      </div>

      {/* Right Arrow */}
      <button
        onClick={scrollRight}
        className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 bg-white shadow-md rounded-full p-2 z-10 hover:bg-gray-100 transition"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
