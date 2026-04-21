'use client'
import { ArrowRight, ChevronDown, ChevronUp, StarIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, useMemo } from "react"
import axios from "axios"
import ProductCard from "./ProductCard"
import { useSelector } from "react-redux"
import normalizeImportedRichText from "@/lib/normalizeImportedRichText"

const formatReviewDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const maskReviewerName = (name) => {
    const safeName = (name || 'Guest User').trim()
    if (safeName.length <= 2) return `${safeName[0] || 'U'}***`
    if (safeName.length <= 5) return `${safeName.slice(0, 2)}***`
    return `${safeName.slice(0, 3)}***${safeName.slice(-1)}`
}

const toTitleCase = (value) => value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

// Updated design - Noon.com style v2
const ProductDescription = ({ product, reviews = [], loadingReviews = false, onReviewAdded, showSuggestedProducts = true }) => {

    // Use reviews and loadingReviews from props only
    const [suggestedProducts, setSuggestedProducts] = useState([])
    const allProducts = useSelector((state) => state.product.list || [])
    const [lightboxImage, setLightboxImage] = useState(null)
    const [showVerifiedInfo, setShowVerifiedInfo] = useState(false)
    const [visibleReviews] = useState(2)
    const [showAllReviewsModal, setShowAllReviewsModal] = useState(false)
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
    const [isAboutExpanded, setIsAboutExpanded] = useState(false)
    const normalizedDescription = useMemo(() => normalizeImportedRichText(product?.description || ''), [product?.description])

    // Calculate rating distribution
    const ratingCounts = [0, 0, 0, 0, 0]
    reviews.forEach(review => {
        if (review.rating >= 1 && review.rating <= 5) {
            ratingCounts[review.rating - 1]++
        }
    })

    const averageRating = reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : 0

    const reviewKeywordPills = useMemo(() => {
        const fallbackPills = [
            { label: 'Charges Fine', count: 1 },
            { label: 'Immediate Use', count: 1 },
            { label: 'First Class', count: 1 }
        ]

        if (!Array.isArray(reviews) || reviews.length === 0) return fallbackPills

        const stopWords = new Set([
            'the', 'and', 'for', 'that', 'this', 'with', 'you', 'your', 'are', 'was', 'were', 'from', 'have',
            'has', 'had', 'not', 'but', 'very', 'just', 'also', 'really', 'will', 'would', 'could', 'should',
            'its', 'it', 'they', 'them', 'their', 'our', 'out', 'into', 'onto', 'about', 'after', 'before',
            'been', 'being', 'can', 'cant', 'did', 'didnt', 'does', 'doesnt', 'dont', 'get', 'got', 'gotten',
            'item', 'product', 'order', 'delivery', 'shipping', 'arrived', 'good', 'nice', 'great', 'best',
            'bad', 'poor', 'ok', 'okay', 'use', 'used', 'using', 'one', 'two', 'buy', 'bought'
        ])

        const wordFrequency = new Map()
        const phraseFrequency = new Map()

        reviews.forEach((review) => {
            const rawText = String(review?.review || '').toLowerCase()
            if (!rawText.trim()) return

            const tokens = rawText
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .map((w) => w.trim())
                .filter((w) => w.length >= 3 && !stopWords.has(w) && !/^\d+$/.test(w))

            if (tokens.length === 0) return

            const uniqueWordsInReview = new Set(tokens)
            uniqueWordsInReview.forEach((word) => {
                wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1)
            })

            const uniquePhrasesInReview = new Set()
            for (let i = 0; i < tokens.length - 1; i++) {
                const phrase = `${tokens[i]} ${tokens[i + 1]}`
                uniquePhrasesInReview.add(phrase)
            }

            uniquePhrasesInReview.forEach((phrase) => {
                phraseFrequency.set(phrase, (phraseFrequency.get(phrase) || 0) + 1)
            })
        })

        const phraseCandidates = [...phraseFrequency.entries()]
            .filter(([, count]) => count >= 2)
            .map(([label, count]) => ({ label: toTitleCase(label), count }))

        const wordCandidates = [...wordFrequency.entries()]
            .filter(([, count]) => count >= 2)
            .map(([label, count]) => ({ label: toTitleCase(label), count }))

        const pills = [...phraseCandidates, ...wordCandidates]
            .sort((a, b) => b.count - a.count || a.label.length - b.label.length)
            .filter((pill, idx, arr) => arr.findIndex((x) => x.label === pill.label) === idx)
            .slice(0, 3)

        return pills.length > 0 ? pills : fallbackPills
    }, [reviews])

    const openReviewImage = (img, fromAllReviewsModal = false) => {
        if (fromAllReviewsModal) {
            setShowAllReviewsModal(false)
        }
        setLightboxImage(img)
    }

    const renderReviewItem = (item, idx, fromAllReviewsModal = false) => {
        const reviewerName = item.user?.name || item.userId?.name || item.customerName || 'Guest User'

        return (
            <div key={item.id || item._id || idx}>
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-8 w-8 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold flex items-center justify-center overflow-hidden">
                        {reviewerName[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1">
                        <div className="text-sm text-gray-700">
                            <span className="font-medium text-gray-900">{maskReviewerName(reviewerName)}</span>
                            <span className="mx-1">in 🇦🇪 on {formatReviewDate(item.createdAt)}</span>
                        </div>

                        <div className="mt-2 flex items-center gap-0.5">
                            {Array(5).fill('').map((_, i) => (
                                <StarIcon
                                    key={i}
                                    size={17}
                                    className="text-transparent"
                                    fill={i < (item.rating || 0) ? '#111827' : '#D1D5DB'}
                                />
                            ))}
                        </div>

                        <p className="mt-2 text-[15px] leading-7 text-gray-900">{item.review}</p>

                        {item.images && item.images.length > 0 && (
                            <div className="mt-3 flex gap-2 flex-wrap">
                                {item.images.map((img, imageIdx) => (
                                    <Image
                                        key={imageIdx}
                                        src={img}
                                        alt={`Review image ${imageIdx + 1}`}
                                        width={76}
                                        height={76}
                                        className="rounded-md object-cover border border-gray-200 cursor-pointer"
                                        onClick={() => openReviewImage(img, fromAllReviewsModal)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    const descriptionPlainText = normalizedDescription.replace(/<[^>]*>/g, '').trim()
    const shouldCollapseDescription = descriptionPlainText.length > 280
    const specTableColumns = Array.isArray(product?.specTableColumns) && product.specTableColumns.length > 0
        ? product.specTableColumns
        : (Array.isArray(product?.attributes?.specTableColumns) && product.attributes.specTableColumns.length > 0
            ? product.attributes.specTableColumns
            : ['Property', 'Value'])
    const specTableRows = Array.isArray(product?.specTableRows)
        ? product.specTableRows
            .filter((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim().length > 0))
            .map((row) => Array.from({ length: specTableColumns.length }, (_, idx) => String(row[idx] || '').trim()))
        : (Array.isArray(product?.attributes?.specRows)
            ? product.attributes.specRows
                .filter((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim().length > 0))
                .map((row) => Array.from({ length: specTableColumns.length }, (_, idx) => String(row[idx] || '').trim()))
            : [])
    const showSpecTable = Boolean((product?.specTableEnabled ?? product?.attributes?.specTableEnabled) && specTableRows.length > 0)
    const normalizedShortDescription2 = useMemo(
        () => normalizeImportedRichText(product?.shortDescription2 || product?.attributes?.shortDescription2 || ''),
        [product?.shortDescription2, product?.attributes?.shortDescription2]
    )
    const aboutPlainText = normalizedShortDescription2.replace(/<[^>]*>/g, '').trim()
    const hasShortDescription2 = aboutPlainText.length > 0
    const shouldCollapseAbout = aboutPlainText.length > 180

    useEffect(() => {
        if (!showSuggestedProducts) return
        fetchSuggestedProducts()
    }, [product._id, allProducts, showSuggestedProducts])

    const fetchSuggestedProducts = () => {
        // Filter products by same category or tags, exclude current product
        const related = allProducts.filter(p => {
            if (p._id === product._id) return false
            
            // Match by category
            if (p.category === product.category) return true
            
            // Match by tags if they exist
            if (product.tags && p.tags) {
                const productTags = Array.isArray(product.tags) ? product.tags : []
                const pTags = Array.isArray(p.tags) ? p.tags : []
                return productTags.some(tag => pTags.includes(tag))
            }
            
            return false
        })
        
        // Shuffle and take first 8 products
        const shuffled = related.sort(() => 0.5 - Math.random())
        setSuggestedProducts(shuffled.slice(0, 8))
    }

    // Remove fetchReviews and handleReviewAdded, use parent handler

    return (
        <div className="mt-3 flex flex-col gap-2 sm:gap-3">

            {showSpecTable && (
                <div className="order-1 bg-white border-t border-gray-300 pt-4 sm:pt-5">
                    <div className="overflow-x-auto">
                        <table className="w-full border-separate border-spacing-0">
                            <tbody>
                                {specTableRows.map((row, rowIdx) => (
                                    <tr key={`spec-row-${rowIdx}`} className="align-top">
                                        {specTableColumns.map((_, colIdx) => (
                                            <td
                                                key={`spec-cell-${rowIdx}-${colIdx}`}
                                                className={`px-3 py-2 text-[14px] leading-6 ${colIdx === 0 ? 'font-semibold text-gray-900 w-[260px]' : 'text-gray-800'} ${rowIdx !== specTableRows.length - 1 ? 'border-b border-gray-100' : ''}`}
                                            >
                                                {row[colIdx] || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {hasShortDescription2 && (
                <div className="order-1 bg-white border-t border-gray-200 pt-4 sm:pt-5">
                    <h2 className="text-[30px] leading-none font-semibold text-gray-900 mb-3">About this item</h2>
                    <div className="relative">
                        <div
                        className={`max-w-none text-[16px] leading-7 text-gray-900
                        [&_p]:mb-2
                        [&_ul]:list-disc [&_ul]:list-outside [&_ul]:pl-5 [&_ul]:mb-2
                        [&_ol]:list-decimal [&_ol]:list-outside [&_ol]:pl-5 [&_ol]:mb-2
                        [&_a]:text-blue-600 [&_a]:underline
                        ${shouldCollapseAbout && !isAboutExpanded ? 'overflow-hidden [display:-webkit-box] [-webkit-line-clamp:4] [-webkit-box-orient:vertical]' : ''}`}
                        dangerouslySetInnerHTML={{ __html: normalizedShortDescription2 }}
                        />

                        {shouldCollapseAbout && !isAboutExpanded && (
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
                        )}
                    </div>

                    {shouldCollapseAbout && (
                        <div className="mt-2">
                            <button
                                onClick={() => setIsAboutExpanded((prev) => !prev)}
                                className="text-[12px] text-gray-600 hover:text-gray-900 hover:underline"
                            >
                                {isAboutExpanded ? 'View less' : 'View more'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Product Description Section */}
            <div className="order-2 bg-white border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-[18px] leading-none font-semibold text-gray-900">Product details</h2>
                    <div className="hidden sm:flex items-center gap-2 text-[13px] text-gray-800">
                        <button className="hover:underline">Save</button>
                        <span>|</span>
                        <button className="hover:underline">Report this item</button>
                    </div>
                </div>

                <div className="relative">
                    <div
                        className={`max-w-none text-[14px] leading-[1.5] text-gray-900
                        [&_h1]:text-[16px] [&_h1]:font-semibold [&_h1]:mb-2
                        [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:mb-2
                        [&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:mb-1.5
                        [&_p]:mb-2
                        [&_ul]:list-disc [&_ul]:list-outside [&_ul]:pl-5 [&_ul]:mb-2
                        [&_ol]:list-decimal [&_ol]:list-outside [&_ol]:pl-5 [&_ol]:mb-2
                        [&_li_p]:mb-0 [&_li_p]:inline
                        [&_img]:max-w-full [&_img]:h-auto [&_img]:my-4
                        [&_video]:max-w-full [&_video]:w-full [&_video]:h-auto [&_video]:my-4
                        ${shouldCollapseDescription && !isDescriptionExpanded ? 'overflow-hidden [display:-webkit-box] [-webkit-line-clamp:6] [-webkit-box-orient:vertical]' : ''}`}
                        dangerouslySetInnerHTML={{ __html: normalizedDescription }}
                    />

                    {shouldCollapseDescription && !isDescriptionExpanded && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
                    )}
                </div>

                {shouldCollapseDescription && (
                    <div className="mt-3 text-center">
                        <button
                            onClick={() => setIsDescriptionExpanded((prev) => !prev)}
                            className="inline-flex items-center gap-1 text-[13px] text-gray-800 hover:text-gray-900"
                        >
                            {isDescriptionExpanded ? 'See less' : 'See more'}
                            {isDescriptionExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                    </div>
                )}
            </div>

            {/* Suggested Products Section */}
            {showSuggestedProducts && suggestedProducts.length > 0 && (
                <div className="bg-white border-0 md:border md:border-gray-200 mt-6">
                    <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900">You May Also Like</h2>
                        {product.category && (
                            <Link 
                                href={`/shop?category=${product.category}`}
                                className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1"
                            >
                                View All <ArrowRight size={16} />
                            </Link>
                        )}
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {suggestedProducts.map((suggestedProduct) => (
                                <ProductCard key={suggestedProduct._id} product={suggestedProduct} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Image Lightbox Modal */}
            {lightboxImage && (
                <div 
                    className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <button
                            onClick={() => setLightboxImage(null)}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl font-bold"
                        >
                            ×
                        </button>
                        <Image
                            src={lightboxImage}
                            alt="Review image full size"
                            width={800}
                            height={800}
                            className="rounded-lg max-h-[85vh] w-auto object-contain"
                        />
                    </div>
                </div>
            )}

            {/* Verified Purchase Info Modal */}
            {showVerifiedInfo && (
                <div className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center p-4" onClick={() => setShowVerifiedInfo(false)}>
                    <div className="w-full max-w-[430px] rounded-md bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowVerifiedInfo(false)}
                                className="-mt-2 -mr-2 h-8 w-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>

                        <h3 className="mt-1 px-4 text-center text-[18px] sm:text-[20px] leading-[1.35] font-semibold text-green-700">
                            All reviews are from customers who have purchased this item.
                        </h3>

                        <div className="mt-4 space-y-4">
                            {[
                                'Customers purchase items on this store.',
                                'Customers will be able to leave a review directly from the order details page after delivery.',
                                'Only verified-purchase reviews are shown for this item.'
                            ].map((line) => (
                                <div key={line} className="flex items-start gap-3 text-[14px] leading-6 font-normal text-gray-800">
                                    <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-white text-[11px]">✓</span>
                                    <p>{line}</p>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowVerifiedInfo(false)}
                            className="mt-6 w-full rounded-full bg-orange-500 py-3 text-lg font-semibold text-white hover:bg-orange-600 transition"
                        >
                            OK
                        </button>

                        <p className="mt-4 text-center text-[14px] text-gray-600">
                            To learn more, please refer to the Review Guidelines &gt;
                        </p>
                    </div>
                </div>
            )}

            {showAllReviewsModal && (
                <div className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center p-4" onClick={() => setShowAllReviewsModal(false)}>
                    <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                            <h3 className="text-lg font-semibold text-gray-900">All Reviews ({reviews.length})</h3>
                            <button
                                onClick={() => setShowAllReviewsModal(false)}
                                className="h-8 w-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                aria-label="Close all reviews"
                            >
                                ×
                            </button>
                        </div>

                        <div className="overflow-y-auto max-h-[calc(85vh-70px)] px-5 py-4 space-y-7">
                            {reviews.map((item, idx) => renderReviewItem(item, idx, true))}
                        </div>
                    </div>
                </div>
            )}
           
        </div>
    )
}

export default ProductDescription
