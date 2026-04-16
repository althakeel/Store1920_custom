'use client';

import { useEffect, useState, useRef } from "react";
import axios from "axios";
import Image from "next/image";
import Link from "next/link";
import { Heart, ChevronRight } from "lucide-react";
import { useStorefrontMarket } from "@/lib/useStorefrontMarket";
import Banner from '../assets/common/bann.jpg'

export default function CarouselSlider() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { market, convertPrice } = useStorefrontMarket();
  const scrollRef = useRef(null);
  const containerRef = useRef(null);
  const [showNextArrow, setShowNextArrow] = useState(false);
  const [showPrevArrow, setShowPrevArrow] = useState(false);

  const scrollNext = () => {
    if (scrollRef.current) {
      const scrollAmount = 232;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollPrev = () => {
    if (scrollRef.current) {
      const scrollAmount = 232;
      scrollRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  };

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowPrevArrow(scrollLeft > 0);
      setShowNextArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  /* ---------------- FETCH PRODUCTS ---------------- */
  useEffect(() => {
    async function fetchCarouselProducts() {
      try {
        const { data: carousel } = await axios.get("/api/store/carousel-products");
        const productIds = carousel.productIds || [];

        if (!productIds.length) {
          setProducts([]);
          return;
        }

        const { data } = await axios.post("/api/products/batch", { productIds });

        const validProducts = (data.products || []).filter(
          (p) => p.slug && p.slug.length > 0
        );

        setProducts(validProducts);
        setShowNextArrow(validProducts.length > 4);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }
    fetchCarouselProducts();
  }, []);

  /* Check scroll position on mount and after scroll */
  useEffect(() => {
    const slider = scrollRef.current;
    if (!slider) return;
    
    checkScroll();
    slider.addEventListener('scroll', checkScroll);
    
    return () => slider.removeEventListener('scroll', checkScroll);
  }, []);

  /* ---------------- DRAG TO SCROLL ---------------- */
  useEffect(() => {
    const slider = scrollRef.current;
    if (!slider) return;
    
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const onMouseDown = (e) => {
      isDown = true;
      slider.classList.add('active');
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
      document.body.classList.add('carousel-noselect');
    };

    const onMouseLeave = () => {
      isDown = false;
      slider.classList.remove('active');
      document.body.classList.remove('carousel-noselect');
    };

    const onMouseUp = () => {
      isDown = false;
      slider.classList.remove('active');
      document.body.classList.remove('carousel-noselect');
    };

    const onMouseMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 1.5;
      slider.scrollLeft = scrollLeft - walk;
    };

    slider.addEventListener('mousedown', onMouseDown);
    slider.addEventListener('mouseleave', onMouseLeave);
    slider.addEventListener('mouseup', onMouseUp);
    slider.addEventListener('mousemove', onMouseMove);
    
    // Touch events for mobile
    let touchStartX = 0;
    let touchScrollLeft = 0;
    const onTouchStart = (e) => {
      touchStartX = e.touches[0].pageX;
      touchScrollLeft = slider.scrollLeft;
    };
    const onTouchMove = (e) => {
      const x = e.touches[0].pageX;
      const walk = (x - touchStartX) * 1.2;
      slider.scrollLeft = touchScrollLeft - walk;
    };
    slider.addEventListener('touchstart', onTouchStart);
    slider.addEventListener('touchmove', onTouchMove);
    
    return () => {
      slider.removeEventListener('mousedown', onMouseDown);
      slider.removeEventListener('mouseleave', onMouseLeave);
      slider.removeEventListener('mouseup', onMouseUp);
      slider.removeEventListener('mousemove', onMouseMove);
      slider.removeEventListener('touchstart', onTouchStart);
      slider.removeEventListener('touchmove', onTouchMove);
      document.body.classList.remove('carousel-noselect');
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      backgroundColor: '#f5f5f5',
      padding: '40px 0',
      marginTop: 0,
      position: 'relative',
    }}>
      {/* Container for carousel and banner */}
      <div ref={containerRef} className="carousel-container" style={{
        maxWidth: '1250px',
        margin: '0 auto',
        position: 'relative',
        display: 'flex',
        gap: 16,
        width: '100%',
        padding: '0 16px',
        boxSizing: 'border-box',
      }}>
        {/* Left Side - Carousel */}
        <div className="carousel-wrapper" style={{ flex: 1, position: 'relative', minHeight: 400 }}>
          {/* Title and subtitle */}
          <div style={{
            marginBottom: 24,
            paddingRight: 10,
          }}>
            <h4 className="carousel-title" style={{
              fontSize: 28,
              fontWeight: 500,
              color: '#000000',
              margin: 0,
              marginBottom: 8,
              letterSpacing: '-0.5px',
              fontFamily: 'Poppins, sans-serif',
            }}>Women’s Dress Collection</h4>
          </div>

          {/* Carousel */}
          <div
            ref={scrollRef}
            style={{
              display: 'flex',
              gap: 8,
              overflowX: products.length > 4 ? 'auto' : 'hidden',
              paddingBottom: 16,
              scrollBehavior: 'smooth',
              paddingRight: 20,
              alignItems: 'flex-start',
              cursor: products.length > 4 ? 'grab' : 'default',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              maxWidth: 'calc((220px * 4.25) + (8px * 4))',
            }}
            className="carousel-scroll"
          >
            {loading ? (
              // Skeleton Loaders
              [...Array(5)].map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  style={{
                    minWidth: 220,
                    maxWidth: 220,
                    width: 220,
                    background: '#fff',
                    borderRadius: 8,
                    padding: 0,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    border: '1px solid #f0f0f0',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Skeleton Image */}
                  <div style={{
                    width: '100%',
                    height: 220,
                    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                  }} />
                  
                  {/* Skeleton Info */}
                  <div style={{
                    width: '100%',
                    padding: '12px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    alignItems: 'center',
                  }}>
                    {/* Title skeleton */}
                    <div style={{
                      width: '90%',
                      height: 14,
                      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      borderRadius: 4,
                    }} />
                    <div style={{
                      width: '70%',
                      height: 14,
                      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      borderRadius: 4,
                    }} />
                    {/* Price skeleton */}
                    <div style={{
                      width: '50%',
                      height: 16,
                      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      borderRadius: 4,
                      marginTop: 4,
                    }} />
                  </div>
                </div>
              ))
            ) : products.length > 0 ? (
              products.map((product) => {
                const imageSrc = product.images?.[0]?.url || product.images?.[0] || "/placeholder.png";
                const convertedPrice = convertPrice(Number(product.price) || 0);
                return (
                  <Link
                    key={product.slug || product.id || product.name}
                    href={`/product/${product.slug}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                  <div
                    style={{
                      minWidth: 220,
                      maxWidth: 220,
                      width: 220,
                      background: '#fff',
                      borderRadius: 8,
                      padding: 0,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      border: '1px solid #f0f0f0',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Next Day Delivery Badge */}
                    {product.nextDayDelivery && (
                      <span style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        zIndex: 20,
                        background: '#ff6b35',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                      }}>
                        Next Day
                      </span>
                    )}

                    {/* Product Image */}
                    <div style={{
                      width: '100%',
                      height: 220,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#ffffff',
                      borderBottom: '1px solid #ffffff',
                      overflow: 'hidden',
                      position: 'relative',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                    }}>
                      <Image
                        src={imageSrc}
                        alt={product.name}
                        width={180}
                        height={180}
                        style={{ 
                          objectFit: 'contain', 
                          maxHeight: '100%', 
                          maxWidth: '100%',
                          pointerEvents: 'none', 
                          userSelect: 'none',
                          padding: '8px',
                        }}
                        draggable={false}
                      />
                    </div>
                    
                    {/* Product Info */}
                    <div style={{
                      width: '100%',
                      padding: '12px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 80,
                      textAlign: 'center',
                    }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#222',
                        marginBottom: 6,
                        width: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.3,
                      }}>
                        {product.name}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: '#666',
                        fontWeight: 600,
                        marginTop: 4,
                      }}>
                        From <span style={{fontWeight: 700, color: '#a51010ff'}}>{market.currency} {Math.round(convertedPrice)}</span>
                      </div>
                    </div>
                  </div>
                  </Link>
                );
              })
            ) : (
              <div style={{
                width: '100%',
                textAlign: 'center',
                padding: '40px 20px',
                color: '#999',
              }}>
                No products available
              </div>
            )}
          </div>

          {/* Left Arrow Button */}
          {showPrevArrow && (
            <button
              className="prev-arrow-button"
              onClick={scrollPrev}
              style={{
                position: 'absolute',
                left: -30,
                top: '45%',
                transform: 'translateY(-50%)',
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: '#fff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                zIndex: 10,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
              }}
            >
              <ChevronRight size={20} color="#666" strokeWidth={2.5} style={{ transform: 'rotate(180deg)' }} />
            </button>
          )}

          {/* Next Arrow Button */}
          {showNextArrow && (
            <button
              className="next-arrow-button"
              onClick={scrollNext}
              style={{
                position: 'absolute',
                right: -30,
                top: '45%',
                transform: 'translateY(-50%)',
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: '#fff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                zIndex: 10,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
              }}
            >
              <ChevronRight size={20} color="#666" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Right Side - Promotional Banner */}
        <div className="banner-container" style={{
          width: 240,
          marginLeft: 0,
          flexShrink: 0,
          position: 'relative',
        }}>
          <div
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: 420,
              background: '#f9f9f9',
              borderRadius: 14,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              boxShadow: '0 4px 16px rgba(40,116,240,0.2)',
              overflow: 'hidden',
              position: 'sticky',
              top: 20,
            }}
          >
            {/* Banner Image Only */}
            <Image 
              src={Banner}
              alt="Promo Banner" 
              width={240}
              height={380}
              priority
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                borderRadius: 16,
                display: 'block',
              }} 
            />
          </div>
        </div>
      </div>

      <style jsx global>{`
        .carousel-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .carousel-scroll::-webkit-scrollbar {
          display: none;
        }

        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          .carousel-container {
            flex-direction: column !important;
            padding: 0 16px !important;
          }
          
          .carousel-wrapper {
            min-height: auto !important;
          }
          
          .carousel-title {
            font-size: 22px !important;
            margin-bottom: 16px !important;
          }
          
          .carousel-scroll {
            max-width: 100% !important;
            gap: 12px !important;
          }
          
          .banner-container {
            display: none !important;
          }
          
          .next-arrow-button {
            right: -15px !important;
          }
        }

        @media (max-width: 480px) {
          .carousel-title {
            font-size: 18px !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------------- STYLES ---------------- */

const wrapperStyle = {
  position: "relative",
  width: "100%",
  marginTop: 30,
  maxWidth: 1440,
  marginLeft: "auto",
  marginRight: "auto",
  paddingLeft: 0,
  paddingRight: 0,
  paddingBottom: 40,
};

const carousel = {
  display: "flex",
  gap: 0,
  overflowX: "auto",
  paddingBottom: 10,
  alignItems: "flex-start",
};
