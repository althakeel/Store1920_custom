"use client"
import ProductDescription from "@/components/ProductDescription";
import ProductDetails from "@/components/ProductDetails";
import ProductCard from "@/components/ProductCard";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Skeleton Loader Components
const ProductDetailsSkeleton = () => (
    <div className="animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Image Skeleton */}
            <div>
                <div className="bg-slate-200 rounded-lg h-96 mb-4"></div>
                <div className="flex gap-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-slate-200 rounded h-20 w-20"></div>
                    ))}
                </div>
            </div>
            
            {/* Details Skeleton */}
            <div className="space-y-4">
                <div className="h-8 bg-slate-200 rounded w-3/4"></div>
                <div className="h-6 bg-slate-200 rounded w-1/4"></div>
                <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                    <div className="h-4 bg-slate-200 rounded w-4/6"></div>
                </div>
                <div className="h-10 bg-slate-200 rounded w-full"></div>
                <div className="h-10 bg-slate-200 rounded w-full"></div>
            </div>
        </div>
    </div>
);

const ProductDescriptionSkeleton = () => (
    <div className="animate-pulse space-y-4 mt-8">
        <div className="h-6 bg-slate-200 rounded w-1/4"></div>
        <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
        </div>
    </div>
);

const RelatedProductsSkeleton = () => (
    <div className="px-4 mt-12 mb-16">
        <div className="h-8 bg-slate-200 rounded w-48 mb-6 animate-pulse"></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="animate-pulse">
                    <div className="bg-slate-200 rounded-lg h-48 mb-3"></div>
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                </div>
            ))}
        </div>
    </div>
);

export default function ProductBySlug() {
    const { slug } = useParams();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recommendedProducts, setRecommendedProducts] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const products = useSelector(state => state.product.list);

    const fetchProduct = async () => {
        setLoading(true);
        try {
            let found = products.find((product) => product.slug === slug);
            
            // If the Redux product is missing variants, refetch from backend to get full data
            const needsFresh = !found || !Array.isArray(found.variants) || found.variants.length === 0;
            
            if (needsFresh) {
                const { data } = await axios.get(`/api/products/by-slug?slug=${encodeURIComponent(slug)}`);
                found = data.product || found || null;
            }
            
            setProduct(found);
            
            // Build recommendations from Redux if available
            if (found && products.length > 0) {
                const sameCategory = products
                    .filter(p => p.slug !== slug && p.category === found.category && p.inStock)
                    .slice(0, 5);

                const fallback = products
                    .filter(p => p.slug !== slug && p.inStock)
                    .slice(0, 5);

                setRecommendedProducts(sameCategory.length > 0 ? sameCategory : fallback);
            } else {
                setRecommendedProducts([]);
            }
        } catch (error) {
            console.error('Error fetching product:', error);
            setProduct(null);
        } finally {
            setLoading(false);
        }
    }

    const fetchReviews = async (productId) => {
        if (!productId) return;
        setLoadingReviews(true);
        try {
            const { data } = await axios.get(`/api/review?productId=${productId}`);
            setReviews(data.reviews || []);
        } catch (error) {
            console.error('Error fetching reviews:', error);
            setReviews([]);
        } finally {
            setLoadingReviews(false);
        }
    };

    useEffect(() => {
        if (slug) {
            fetchProduct();
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }, [slug]);

    useEffect(() => {
        const productId = product?._id || product?.id;
        if (productId) {
            fetchReviews(productId);
        }
    }, [product?._id, product?.id]);

    // Track browse history for signed-in users and localStorage for guests
    useEffect(() => {
        const productId = product?._id || product?.id;
        if (!productId) return;

        let unsubscribe;

        const trackView = async (user) => {
            if (user) {
                // Logged in - save to database
                try {
                    const token = await user.getIdToken();
                    await axios.post('/api/browse-history', 
                        { productId },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } catch (error) {
                    // Silent fail - don't interrupt user experience
                }
            } else {
                // Guest - save to localStorage
                try {
                    const viewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
                    // Remove if already exists and add to front
                    const filtered = viewed.filter(id => id !== productId);
                    filtered.unshift(productId);
                    // Keep only 20 most recent
                    localStorage.setItem('recentlyViewed', JSON.stringify(filtered.slice(0, 20)));
                } catch (error) {
                    console.error('Error saving to localStorage:', error);
                }
            }
        };

        unsubscribe = onAuthStateChanged(auth, trackView);

        return () => unsubscribe?.();
    }, [product?._id, product?.id]);

    return (
        <div className="w-full">
            <div className="w-full md:max-w-[1250px] md:mx-auto px-0 md:px-2 md:sm:px-6 pb-24 lg:pb-0">
                {/* Product Details */}
                {loading ? (
                    <>
                        <ProductDetailsSkeleton />
                        <ProductDescriptionSkeleton />
                        <RelatedProductsSkeleton />
                    </>
                ) : product ? (
                    <>
                        <ProductDetails product={product} reviews={reviews} loadingReviews={loadingReviews} />
                        <ProductDescription product={product} reviews={reviews || []} loadingReviews={loadingReviews} onReviewAdded={() => fetchReviews(product._id || product.id)} />
                        {/* Recommended Products */}
                        {recommendedProducts.length > 0 && (
                            <div className="-mx-0 md:mx-0 mt-12 mb-16">
                                <div className="px-4 md:px-0">
                                    <h2 className="text-2xl font-semibold text-slate-800 mb-6">Recommended Products</h2>
                                </div>
                                <div className="px-4 md:px-0">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-6">
                                        {recommendedProducts.map((prod) => (
                                            <ProductCard key={prod._id || prod.id} product={prod} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-16">
                        <div className="text-slate-400 text-lg">Product not found.</div>
                        <p className="text-slate-500 text-sm mt-2">The product you're looking for doesn't exist or has been removed.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
