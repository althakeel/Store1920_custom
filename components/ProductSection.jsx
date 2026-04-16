'use client'
import { ChevronRightIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useStorefrontMarket } from "@/lib/useStorefrontMarket";

export default function ProductSection({ title, products, viewAllLink }) {
    const router = useRouter();
    const { market, convertPrice } = useStorefrontMarket();

    if (!products || products.length === 0) return null;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                {viewAllLink && (
                    <button
                        onClick={() => router.push(viewAllLink)}
                        className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium flex items-center gap-1"
                    >
                        See more
                        <ChevronRightIcon size={16} />
                    </button>
                )}
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-4">
                {products.slice(0, 12).map((product) => (
                    <div
                        key={product._id}
                        onClick={() => product.slug && router.push(`/product/${product.slug}`)}
                        className={`cursor-pointer group hover:shadow-md transition-all duration-200 rounded-lg p-2 hover:bg-gray-50 ${!product.slug ? 'opacity-50 pointer-events-none' : ''}`}
                        title={product.slug ? '' : 'No slug set for this product'}
                    >
                        {/* Product Image */}
                        <div className="relative aspect-square bg-white rounded-lg overflow-hidden mb-2 border border-gray-100">
                            <Image
                                src={product.images[0]}
                                alt={product.name}
                                fill
                                className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                            />
                        </div>
                        {/* Product Info */}
                        <div className="space-y-1">
                            <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-orange-600 transition">
                                {product.name}
                            </h3>
                                                        {/* Show price row only if at least one price is > 0 */}
                                                        {(Number(product.price) > 0 || Number(product.AED) > 0) && (
                                                            <div className="flex items-center gap-2">
                                                                {/* Show sale price if > 0 */}
                                                                {Number(product.price) > 0 && (
                                                                    <span className="text-sm font-bold text-gray-900">{market.currency} {Math.round(convertPrice(Number(product.price) || 0))}</span>
                                                                )}
                                                                {/* Show regular price only if > 0, greater than price, and price > 0 */}
                                                                {Number(product.AED) > 0 && Number(product.AED) > Number(product.price) && Number(product.price) > 0 && (
                                                                    <span className="text-xs text-gray-500 line-through">{market.currency} {Math.round(convertPrice(Number(product.AED) || 0))}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {/* Remove any trailing '0' if AED is not valid */}
                                                        {/* Show discount only if AED > 0 and greater than price and price > 0 */}
                                                        {Number(product.AED) > 0 && Number(product.AED) > Number(product.price) && Number(product.price) > 0 && (
                                                            <span className="text-xs text-green-600 font-medium">
                                                                {Math.round(((product.AED - product.price) / product.AED) * 100)}% off
                                                            </span>
                                                        )}
                        </div>
                        {!product.slug && (
                            <div className="text-xs text-red-500 mt-2">No slug set for this product</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
