"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useStorefrontMarket } from "@/lib/useStorefrontMarket";

const TOP_DEALS_SECTION_KEYS = new Set(["top_deals", "top-deals", "topdeals"]);

export default function TopDeals() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("Top Deals");
  const { market, convertPrice } = useStorefrontMarket();

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: sectionData }, { data: productData }] = await Promise.all([
          axios.get("/api/admin/home-sections"),
          axios.get("/api/products")
        ]);

        const adminSections = sectionData.sections || [];
        const allProducts = productData.products || productData;

        const normalizeKey = (value) =>
          String(value || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");

        const normalizeId = (value) => {
          if (!value) return null;
          if (typeof value === "string" || typeof value === "number") return String(value);
          if (typeof value === "object") {
            if (value.$oid) return String(value.$oid);
            const stringValue = value.toString?.();
            return stringValue && stringValue !== "[object Object]" ? String(stringValue) : null;
          }
          return null;
        };

        const section =
          adminSections.find((item) => TOP_DEALS_SECTION_KEYS.has(normalizeKey(item.section))) ||
          adminSections.find((item) => normalizeKey(item.title) === "top_deals") ||
          adminSections.find((item) => item.category);

        let result = allProducts;

        if (section?.title) {
          setTitle(section.title);
        }

        if (section?.sectionType === "manual" && Array.isArray(section.productIds) && section.productIds.length > 0) {
          const selectedProductIds = new Set(section.productIds.map(normalizeId).filter(Boolean));
          result = allProducts.filter((product) =>
            selectedProductIds.has(normalizeId(product._id || product.id || product.productId))
          );
        } else if (section?.category) {
          result = allProducts.filter((product) => product.category === section.category);
        }

        setProducts(result);
      } catch {
        setProducts([]);
        setTitle("Top Deals");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="w-full flex justify-center mt-6 sm:mt-8">
      <div className="w-full max-w-[1400px] px-4 sm:px-6">
        <div className="w-full">
          <h2 className="text-base sm:text-lg md:text-[28px] font-semibold mb-4 sm:mb-5">{title}</h2>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
              {[...Array(12)].map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="cursor-pointer text-center flex flex-col items-center"
                >
                  {/* Skeleton Image */}
                  <div
                    className="w-full aspect-square rounded-md"
                    style={{
                      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }}
                  />
                  {/* Skeleton Title */}
                  <div
                    className="h-2 sm:h-3 mx-auto mt-2 sm:mt-3 rounded"
                    style={{
                      width: '80%',
                      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }}
                  />
                  {/* Skeleton Price */}
                  <div
                    className="h-2 sm:h-3 mx-auto mt-1.5 sm:mt-2 rounded"
                    style={{
                      width: '60%',
                      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }}
                  />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="text-gray-500 py-8 text-center text-sm sm:text-base">No Deals Found</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
              {products?.slice(0, 12).map((item, i) => {
                const img =
                  item.images?.[0] && item.images[0] !== ""
                    ? item.images[0]
                    : "https://ik.imagekit.io/jrstupuke/placeholder.png";
                const convertedPrice = convertPrice(Number(item.price) || 0);

                return (
                  <a
                    key={i}
                    href={`/product/${item.slug}`}
                    className="cursor-pointer text-center block group flex flex-col items-center"
                  >
                    <div className="w-full aspect-square bg-gray-50 rounded-md overflow-hidden flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                      <img
                        src={img}
                        alt={item.name}
                        className="h-full w-full object-contain p-2 sm:p-3 group-hover:scale-110 transition-transform duration-200"
                        onError={e => { e.currentTarget.src = "https://ik.imagekit.io/jrstupuke/placeholder.png"; }}
                      />
                    </div>
                    <p className="w-full truncate px-1 text-[11px] font-medium mt-2 sm:mt-2.5 sm:text-[13px] md:text-[15px] sm:whitespace-normal sm:line-clamp-2">
                      {item.name}
                    </p>
                    <p className="font-bold text-[10px] sm:text-[12px] md:text-[16px] mt-1 sm:mt-1.5 text-[#E6003E]">
                      From {market.currency} {Math.round(convertedPrice)}
                    </p>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
