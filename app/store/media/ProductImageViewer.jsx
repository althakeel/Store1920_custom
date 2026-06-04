'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight, Download, AlertCircle } from 'lucide-react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/lib/useAuth'

export default function ProductImageViewer({ product, onClose }) {
  const { getToken } = useAuth()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)

  const images = product.images || []

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const downloadImage = async (imageUrl, index) => {
    try {
      setIsDownloading(true)
      const token = await getToken()
      
      if (!token) {
        toast.error('Authentication failed - please login again')
        return
      }

      console.log('[DOWNLOAD] Starting download for image', index + 1);
      
      const response = await axios.get('/api/store/download-image', {
        params: {
          url: imageUrl,
          filename: `${product.name}-image-${index + 1}.jpg`,
        },
        headers: { 
          'Authorization': `Bearer ${token}`,
        },
        responseType: 'blob',
        timeout: 60000,
      })

      const blob = new Blob([response.data], { type: 'image/jpeg' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${product.name}-image-${index + 1}.jpg`
      document.body.appendChild(link)
      link.click()
      if (link.parentNode) {
        link.remove()
      }
      window.URL.revokeObjectURL(url)
      
      console.log('[DOWNLOAD] Image downloaded successfully:', index + 1);
      toast.success('Image downloaded successfully')
    } catch (error) {
      console.error('[DOWNLOAD ERROR]:', {
        image: index + 1,
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      })
      const errorMsg = error.response?.data?.error || error.message || 'Failed to download image'
      toast.error('Download failed: ' + errorMsg)
    } finally {
      setIsDownloading(false)
    }
  }

  const downloadAllImages = async () => {
    try {
      setIsDownloading(true)
      const token = await getToken()

      if (!token) {
        toast.error('Authentication failed - please login again')
        return
      }

      toast(`Downloading ${images.length} images...`)
      let successCount = 0
      let failCount = 0
      
      // Download images individually with delay
      for (let i = 0; i < images.length; i++) {
        try {
          console.log(`[DOWNLOAD ALL] Starting image ${i + 1}/${images.length}`);

          const response = await axios.get('/api/store/download-image', {
            params: {
              url: images[i],
              filename: `${product.name}-image-${i + 1}.jpg`,
            },
            headers: { 
              'Authorization': `Bearer ${token}`,
            },
            responseType: 'blob',
            timeout: 60000,
          })

          const blob = new Blob([response.data], { type: 'image/jpeg' })
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `${product.name}-image-${i + 1}.jpg`
          document.body.appendChild(link)
          link.click()
          if (link.parentNode) {
            link.remove()
          }
          window.URL.revokeObjectURL(url)
          
          successCount++
          console.log(`[DOWNLOAD ALL] Image ${i + 1} downloaded successfully`);

          // Add delay between downloads to avoid overwhelming the browser
          if (i < images.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 800))
          }
        } catch (err) {
          failCount++
          console.error(`[DOWNLOAD ALL] Failed image ${i + 1}:`, {
            status: err.response?.status,
            message: err.message,
            data: err.response?.data,
          })
          toast.error(`Image ${i + 1} failed: ${err.response?.data?.error || err.message}`)
        }
      }
      
      if (successCount > 0) {
        toast.success(`Downloaded ${successCount}/${images.length} images`)
      } else {
        toast.error('Failed to download all images')
      }
    } catch (error) {
      console.error('[DOWNLOAD ALL ERROR]:', error)
      toast.error('Failed to download images: ' + (error.message || 'Unknown error'))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900">{product.name}</h2>
            <p className="text-sm text-slate-600 mt-1">
              Product ID: {product._id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {images.length > 0 ? (
            <>
              {/* Main Image Display */}
              <div className="mb-8">
                <div className="relative w-full h-96 bg-slate-100 rounded-lg overflow-hidden mb-4 flex items-center justify-center">
                  <Image
                    src={images[currentImageIndex]}
                    alt={`${product.name} - Image ${currentImageIndex + 1}`}
                    fill
                    className="object-contain"
                  />
                </div>

                {/* Image Navigation */}
                {images.length > 1 && (
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={handlePrevImage}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      disabled={isDownloading}
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <div className="text-center text-slate-600">
                      <p className="font-medium">
                        Image {currentImageIndex + 1} of {images.length}
                      </p>
                    </div>
                    <button
                      onClick={handleNextImage}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      disabled={isDownloading}
                    >
                      <ChevronRight size={24} />
                    </button>
                  </div>
                )}

                {/* Download Buttons */}
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={() => downloadImage(images[currentImageIndex], currentImageIndex)}
                    disabled={isDownloading}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={18} />
                    {isDownloading ? 'Downloading...' : 'Download Current'}
                  </button>
                  {images.length > 1 && (
                    <button
                      onClick={downloadAllImages}
                      disabled={isDownloading}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download size={18} />
                      {isDownloading ? 'Downloading...' : 'Download All'}
                    </button>
                  )}
                </div>
              </div>

              {/* Thumbnail Grid */}
              {images.length > 1 && (
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">All Images</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {images.map((image, index) => (
                      <div
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`relative h-24 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                          currentImageIndex === index
                            ? 'border-blue-500'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Image
                          src={image}
                          alt={`Thumbnail ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 hover:bg-black hover:bg-opacity-10 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center">
              <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-600">No images available for this product</p>
            </div>
          )}

          {/* Product Details */}
          <div className="border-t border-slate-200 mt-8 pt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-600">SKU</p>
              <p className="font-semibold text-slate-900">{product.sku || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Stock</p>
              <p className="font-semibold text-slate-900">{product.stockQuantity || 0}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Price</p>
              <p className="font-semibold text-slate-900">AED{product.salePrice || product.price}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Images</p>
              <p className="font-semibold text-slate-900">{images.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
