
'use client'
import MobileBottomNav from "@/components/MobileBottomNav";
import GuestOrderLinker from "@/components/GuestOrderLinker";
import UtmTracker from "@/components/UtmTracker";
import AdsAttribution from "@/components/AdsAttribution";
import CustomerSessionTracker from "@/components/CustomerSessionTracker";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { fetchProducts } from "@/lib/features/product/productSlice";

function PublicLayoutContent({ children }) {
    const dispatch = useDispatch();
    const { cartItems } = useSelector((state) => state.cart);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isHomePage = pathname === '/';
    const isCheckout = pathname === '/checkout';
    const isCartPage = pathname === '/cart';
    const isShopCategoryPage = pathname === '/shop' && Boolean(searchParams.get('category'));

    useEffect(() => { 
        // Homepage sections load their own product slices; shop pages load catalog as needed.
        if (isHomePage || isShopCategoryPage) return undefined;

        const timer = setTimeout(() => {
            dispatch(fetchProducts({ limit: 100 }));
        }, 100);
        return () => clearTimeout(timer);
    }, [dispatch, isHomePage, isShopCategoryPage]);

    return (
        <div className={`flex flex-col ${isCartPage ? '' : 'min-h-screen'}`}>
            <GuestOrderLinker />
            <UtmTracker />
            <AdsAttribution />
            <CustomerSessionTracker />
            {/* <Banner />/ */}
            <main className={`flex-1 ${isHomePage ? 'pb-8' : 'pb-20'} lg:pb-0`}>{children}</main>
            {!isHomePage && !isCheckout && <MobileBottomNav />}
        </div>
    );
}

function PublicLayoutAuthed({ children }) {
    return (
        <Suspense fallback={<div className="flex flex-col"><GuestOrderLinker /><main className="flex-1 pb-20 lg:pb-0">{children}</main></div>}>
            <PublicLayoutContent>{children}</PublicLayoutContent>
        </Suspense>
    );
}

export default function PublicLayout(props) {
    return <PublicLayoutAuthed {...props} />;
}
