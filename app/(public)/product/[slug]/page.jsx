"use client"
import ProductDescription from "@/components/ProductDescription";
import ProductDetails from "@/components/ProductDetails";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useStorefrontI18n } from "@/lib/useStorefrontI18n";
import { localizeRecord } from "@/lib/storefrontLanguage";

// Skeleton Loader Components
const ProductDetailsSkeleton = () => (
    <div className="animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-8 items-start">
            <div>
                <div className="h-[360px] sm:h-[420px] md:h-[500px] rounded-2xl bg-slate-200" />
                <div className="mt-3 flex gap-2 overflow-hidden">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg bg-slate-200" />
                    ))}
                </div>

                <div className="mt-8 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <div className="h-7 w-56 rounded bg-slate-200" />
                        <div className="h-6 w-64 rounded bg-slate-200" />
                    </div>

                    <div className="flex gap-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-8 w-28 rounded-full border border-slate-200 bg-slate-100" />
                        ))}
                    </div>

                    {[1, 2].map((i) => (
                        <div key={i} className="space-y-2.5">
                            <div className="h-4 w-44 rounded bg-slate-200" />
                            <div className="h-4 w-24 rounded bg-slate-200" />
                            <div className="h-4 w-full rounded bg-slate-200" />
                            <div className="h-4 w-10/12 rounded bg-slate-200" />
                        </div>
                    ))}

                    <div className="pt-2">
                        <div className="h-8 w-52 rounded bg-slate-200 mb-4" />
                        <div className="space-y-2.5">
                            <div className="h-4 w-full rounded bg-slate-200" />
                            <div className="h-4 w-11/12 rounded bg-slate-200" />
                            <div className="h-4 w-9/12 rounded bg-slate-200" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="h-6 w-24 rounded-full bg-slate-200" />
                <div className="h-9 w-5/6 rounded bg-slate-200" />
                <div className="h-5 w-1/2 rounded bg-slate-200" />

                <div className="space-y-2">
                    <div className="h-4 w-full rounded bg-slate-200" />
                    <div className="h-4 w-11/12 rounded bg-slate-200" />
                    <div className="h-4 w-8/12 rounded bg-slate-200" />
                </div>

                <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                    <div className="h-9 rounded-lg bg-slate-200" />
                    <div className="h-9 rounded-lg bg-slate-200" />
                    <div className="h-14 rounded-full bg-slate-200" />
                    <div className="h-14 rounded-full bg-slate-200" />
                </div>

                <div className="rounded-xl border border-slate-200 p-3 space-y-2.5">
                    <div className="h-4 w-1/3 rounded bg-slate-200" />
                    <div className="h-3.5 w-1/2 rounded bg-slate-200" />
                    <div className="h-20 rounded-lg bg-slate-200" />
                    <div className="h-4 w-2/3 rounded bg-slate-200" />
                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                    <div className="h-4 w-1/3 rounded bg-slate-200" />
                </div>
            </div>
        </div>
    </div>
);

const RelatedProductsSkeleton = () => (
    <div className="mt-12 mb-16">
        <div className="h-8 bg-slate-200 rounded w-56 mb-6 animate-pulse"></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="animate-pulse">
                    <div className="bg-slate-200 rounded-xl h-48 mb-3"></div>
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                </div>
            ))}
        </div>
    </div>
);

export default function ProductBySlug() {
    const { slug } = useParams();
    const { language } = useStorefrontI18n();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recommendedProducts, setRecommendedProducts] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const products = useSelector(state => state.product.list);

    const localizeProductFields = (item) => {
        if (!item) return item;
        return localizeRecord(item, language, ['name', 'description', 'shortDescription', 'brand']);
    };

    const resolveCategoryNames = (item) => {
        const candidates = [
            item?.category,
            ...(Array.isArray(item?.categories) ? item.categories : []),
        ];

        return [...new Set(candidates
            .map((value) => {
                if (!value) return null;
                if (typeof value === 'string') return value.trim();
                if (typeof value === 'object') return value.name || value.slug || null;
                return null;
            })
            .filter(Boolean))];
    };

    const hasCategoryOverlap = (candidate, categoryNames) => {
        if (!categoryNames.length) return false;
        const candidateCategories = resolveCategoryNames(candidate).map((name) => name.toLowerCase());
        return categoryNames.some((name) => candidateCategories.includes(name.toLowerCase()));
    };

    const buildLocalRecommendations = (currentProduct, sourceProducts) => {
        if (!currentProduct || !Array.isArray(sourceProducts) || sourceProducts.length === 0) return [];

        const currentCategories = resolveCategoryNames(currentProduct);
        const sameCategory = sourceProducts.filter((candidate) => (
            candidate?.slug !== currentProduct.slug &&
            candidate?.inStock &&
            hasCategoryOverlap(candidate, currentCategories)
        ));

        if (sameCategory.length > 0) {
            return sameCategory.slice(0, 5).map(localizeProductFields);
        }

        return sourceProducts
            .filter((candidate) => candidate?.slug !== currentProduct.slug && candidate?.inStock)
            .slice(0, 5)
            .map(localizeProductFields);
    };

    const fetchApiRecommendations = async (currentProduct) => {
        const currentCategories = resolveCategoryNames(currentProduct);

        for (const categoryName of currentCategories) {
            try {
                const { data } = await axios.get(`/api/products?category=${encodeURIComponent(categoryName)}&limit=12`);
                const matches = Array.isArray(data?.products)
                    ? data.products
                        .filter((candidate) => candidate?.slug !== currentProduct.slug && candidate?.inStock)
                        .slice(0, 5)
                        .map(localizeProductFields)
                    : [];

                if (matches.length > 0) {
                    return matches;
                }
            } catch (error) {
                // Ignore category recommendation fetch failure and try fallback options.
            }
        }

        try {
            const { data } = await axios.get('/api/products?limit=12');
            return Array.isArray(data?.products)
                ? data.products
                    .filter((candidate) => candidate?.slug !== currentProduct.slug && candidate?.inStock)
                    .slice(0, 5)
                    .map(localizeProductFields)
                : [];
        } catch (error) {
            return [];
        }
    };

    const fetchProduct = async () => {
        setLoading(true);
        try {
            let found = products.find((product) => product.slug === slug);
            found = localizeProductFields(found);
            
            // Refetch only when product is missing OR it is a variant product with incomplete variant data
            const needsFresh = !found || (found?.hasVariants && (!Array.isArray(found.variants) || found.variants.length === 0));
            
            if (needsFresh) {
                const response = await axios.get(
                    `/api/products/by-slug?slug=${encodeURIComponent(slug)}&lang=${language}`,
                    { validateStatus: (status) => status === 200 || status === 404 }
                );

                if (response.status === 200) {
                    found = localizeProductFields(response.data.product) || found || null;
                    console.log('🔍 FETCHED PRODUCT SPECS:', { specTableEnabled: found?.attributes?.specTableEnabled, specRows: found?.attributes?.specRows });
                } else if (response.status === 404) {
                    found = found || null;
                }
            }
            
            setProduct(found);
            if (found) {
                console.log('🔍 PRODUCT ATTRIBUTES:', { attributes: found?.attributes });
                const localRecommendations = buildLocalRecommendations(found, products);
                if (localRecommendations.length > 0) {
                    setRecommendedProducts(localRecommendations);
                } else {
                    const apiRecommendations = await fetchApiRecommendations(found);
                    setRecommendedProducts(apiRecommendations);
                }
            } else {
                setRecommendedProducts([]);
            }
        } catch (error) {
            console.error('Error fetching product:', error);
            setProduct(null);
            setRecommendedProducts([]);
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
    }, [slug, language]);

    useEffect(() => {
        const productId = product?._id || product?.id;
        if (productId) {
            fetchReviews(productId);
        }
    }, [product?._id, product?.id]);

    useEffect(() => {
        if (!product) return;

        const metaTitle = String(product.seoTitle || product.name || '').trim();
        const metaDescription = String(product.seoDescription || product.shortDescription || '').trim();
        const keywordList = Array.isArray(product.seoKeywords) && product.seoKeywords.length > 0
            ? product.seoKeywords
            : (Array.isArray(product.tags) ? product.tags : []);

        if (metaTitle) {
            document.title = metaTitle;
        }

        const descriptionTag = document.querySelector('meta[name="description"]') || document.createElement('meta');
        descriptionTag.setAttribute('name', 'description');
        if (metaDescription) {
            descriptionTag.setAttribute('content', metaDescription);
        }
        if (!descriptionTag.parentNode) {
            document.head.appendChild(descriptionTag);
        }

        const keywordsTag = document.querySelector('meta[name="keywords"]') || document.createElement('meta');
        keywordsTag.setAttribute('name', 'keywords');
        if (keywordList.length > 0) {
            keywordsTag.setAttribute('content', keywordList.join(', '));
        }
        if (!keywordsTag.parentNode) {
            document.head.appendChild(keywordsTag);
        }
    }, [product]);

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
            <div className="w-full pb-24 lg:pb-0">
                {/* Product Details */}
                {loading ? (
                    <div>
                        <div className="border-b border-gray-100">
                            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5">
                                <div className="h-4 w-72 rounded bg-slate-200 animate-pulse" />
                            </div>
                        </div>
                        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 pb-8">
                            <ProductDetailsSkeleton />
                            <RelatedProductsSkeleton />
                        </div>
                    </div>
                ) : product ? (
                    <>
                        <ProductDetails product={product} reviews={reviews} loadingReviews={loadingReviews} onReviewAdded={() => fetchReviews(product._id || product.id)} recommendedProducts={recommendedProducts} />
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
