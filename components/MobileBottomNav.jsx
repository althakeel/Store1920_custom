
'use client'
import React from 'react'
import { Home, Search, ShoppingCart, User, LayoutGrid } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSelector } from 'react-redux'
import { isProductDetailPath } from '@/lib/productUrl'

export default function MobileBottomNav() {
  const [hydrated, setHydrated] = React.useState(false)
  React.useEffect(() => { setHydrated(true) }, []);
  const pathname = usePathname()
  const cartCount = useSelector((state) => state.cart.total)
  const { user, loading: authLoading } = useAuth();
  const isSignedIn = !!user;

  // Don't show on product pages (will have separate fixed bar)
  if (isProductDetailPath(pathname)) {
    return null
  }

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/categories', icon: LayoutGrid, label: 'Categories' },
    { href: '/cart', icon: ShoppingCart, label: 'Cart', badge: cartCount },
    { href: isSignedIn ? '/orders' : '/sign-in', icon: User, label: isSignedIn ? 'My Account' : 'Account' },
  ]

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50 safe-area-bottom">
      <div className="flex items-stretch justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 transition-colors relative ${
                isActive 
                  ? 'text-gray-900' 
                  : 'text-gray-500'
              }`}
            >
              <div className="relative mb-1">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {hydrated && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] leading-tight ${isActive ? 'font-medium' : 'font-normal'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
