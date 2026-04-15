"use client";

import { useEffect, useMemo, useState } from 'react';

import {
  STOREFRONT_LANGUAGE_EVENT,
  STOREFRONT_LANGUAGE_KEY,
} from '@/lib/storefrontLanguage';

const STATIC_TRANSLATIONS = {
  en: {
    'common.addToCart': 'Add to cart',
    'common.addedToCart': 'Added to cart',
    'common.outOfStock': 'Out of stock',
    'common.noReviews': 'No reviews',
    'common.noReviewsYet': 'No reviews yet',
    'common.fast': 'Fast',
    'common.fastDelivery': 'Fast Delivery',
    'common.freeShip': 'Free Ship',
    'common.product': 'Product',
    'common.untitledProduct': 'Untitled Product',
    'common.viewMore': 'View more',
    'common.offPercent': '{discount}% off',
    'common.home': 'Home',
    'common.products': 'Products',
    'common.or': 'or',
    'common.copy': 'Copy',
    'common.copied': 'Copied!',
    'common.topPick': 'Top Pick',
    'common.freeDelivery': 'Free Delivery',
    'common.sellingFast': 'Selling out fast',
    'common.priority': 'Priority',
    'common.saveItem': 'Save item',
    'common.addedToWishlist': 'Added to wishlist',
    'common.removedFromWishlist': 'Removed from wishlist',
    'common.wishlistUpdateFailed': 'Failed to update wishlist',

    'cart.items': 'Items',
    'cart.shippingAndHandling': 'Shipping & handling',
    'cart.free': 'FREE',
    'cart.total': 'Total',
    'cart.continueShopping': 'Continue Shopping',
    'cart.checkout': 'Checkout',
    'cart.checkoutUnavailable': 'Checkout Unavailable',

    'footer.shop': 'SHOP',
    'footer.allProducts': 'All Products',
    'footer.topSelling': 'Top Selling',
    'footer.newArrivals': 'New Arrivals',
    'footer.categories': 'Categories',
    'footer.customerCare': 'CUSTOMER CARE',
    'footer.trackOrder': 'Track Order',
    'footer.myOrders': 'My Orders',
    'footer.myWishlist': 'My Wishlist',
    'footer.faq': 'FAQ',
    'footer.support': 'Support',
    'footer.legalInfo': 'LEGAL & INFO',
    'footer.termsAndConditions': 'Terms & Conditions',
    'footer.termsOfSale': 'Terms of Sale',
    'footer.shippingPolicy': 'Shipping Policy',
    'footer.privacyPolicy': 'Privacy Policy',
    'footer.cancellationRefunds': 'Cancellation & Refunds',
    'footer.contactUs': 'Contact Us',
    'footer.sitemap': 'Sitemap',
    'footer.aboutStore': 'ABOUT Store1920',
    'footer.aboutUs': 'About Us',
    'footer.createYourStore': 'Create Your Store',
    'footer.becomeSeller': 'Become a Seller',
    'footer.careers': 'Careers',
    'footer.description': 'Your ultimate destination for the latest gadgets and electronics. Quality products, fast delivery, and exceptional service.',
    'footer.uae': 'United Arab Emirates',
    'footer.allRightsReserved': 'All rights reserved.',

    'featured.title': 'Featured Selection',
    'featured.description': 'Handpicked products just for you',
    'featured.empty': 'No featured products selected yet.',

    'navbar.deliverTo': 'Deliver to',
    'navbar.signInToChoose': 'Sign in to choose',
    'navbar.selectAddress': 'Select address',
    'navbar.addAddress': 'Add address',
    'navbar.searchFragrances': 'Search for "Fragrances"',
    'navbar.dashboard': 'Dashboard',
    'navbar.sellerDashboard': 'Seller Dashboard',
    'navbar.profile': 'Profile',
    'navbar.orders': 'Orders',
    'navbar.wishlist': 'Wishlist',
    'navbar.addresses': 'Addresses',
    'navbar.accountSettings': 'Account Settings',
    'navbar.signOut': 'Sign Out',
    'navbar.signInRegister': 'Sign In / Register',
    'navbar.support': 'Support',
    'navbar.faq': 'FAQ',
    'navbar.termsAndConditions': 'Terms & Conditions',
    'navbar.privacyPolicy': 'Privacy Policy',
    'navbar.returnPolicy': 'Return Policy',
    'navbar.language': 'Language',
    'navbar.shopIn': 'Shop In',
    'navbar.currency': 'Currency',
    'navbar.shoppingIn': 'You are shopping in {country}.',
    'navbar.cart': 'Cart',
    'navbar.myOrders': 'My Orders',
    'navbar.browseHistory': 'Browse History',
    'navbar.topSellingItems': 'Top Selling Items',
    'navbar.newArrivals': 'New Arrivals',
    'navbar.fiveStarRated': '5 Star Rated',
    'navbar.fastDelivery': 'Fast Delivery',
    'navbar.login': 'Login',
    'navbar.signUp': 'Sign Up',
    'navbar.wallet': 'Wallet',
    'navbar.emptyCartToast': 'Your cart is empty. Add some products to get started!',
    'navbar.readyToSignOut': 'Ready to sign out?',
    'navbar.saveCartWishlist': 'We will save your cart and wishlist. You can jump back in anytime.',
    'navbar.staySignedIn': 'Stay Signed In',
    'navbar.hiUser': 'Hi, {name}',

    'support.title': "We're Always Here To Help",
    'support.subtitle': 'Reach out to us through our support email',
    'support.emailLabel': 'Email Support',

    'product.loading': 'Loading product…',
    'product.notFound': 'Product not found.',
    'product.used': 'Used',
    'product.shareTo': 'Share to',
    'product.itemId': 'Item ID:',
    'product.soldCount': '{count} sold',
    'product.soldBy': 'Sold by',
    'product.limitedStockAvailable': 'Limited stock: {count} available',
    'product.limitedTime': 'limited time',
    'product.almostSoldOut': 'ALMOST SOLD OUT',
    'product.installments': '4 interest-free installments of {amount} with',
    'product.color': 'Color',
    'product.size': 'Size',
    'product.outLabel': 'OUT',
    'product.bundleAndSave': 'BUNDLE AND SAVE MORE!',
    'product.mostPopular': 'MOST POPULAR',
    'product.perfectFor2Pack': 'Perfect for 2 Pack',
    'product.bestValue': 'Best Value',
    'product.buy1': 'Buy 1',
    'product.bundleOf': 'Bundle of {qty}',
    'product.qty': 'Qty',
    'product.discountAddToCart': '-{discount}% now! Add to cart',
  },
  ar: {
    'common.addToCart': 'أضف إلى السلة',
    'common.addedToCart': 'تمت الإضافة إلى السلة',
    'common.outOfStock': 'نفد المخزون',
    'common.noReviews': 'لا توجد مراجعات',
    'common.noReviewsYet': 'لا توجد مراجعات بعد',
    'common.fast': 'سريع',
    'common.fastDelivery': 'توصيل سريع',
    'common.freeShip': 'شحن مجاني',
    'common.product': 'منتج',
    'common.untitledProduct': 'منتج بدون اسم',
    'common.viewMore': 'عرض المزيد',
    'common.offPercent': '{discount}% خصم',
    'common.home': 'الرئيسية',
    'common.products': 'المنتجات',
    'common.or': 'أو',
    'common.copy': 'نسخ',
    'common.copied': 'تم النسخ',
    'common.topPick': 'اختيار مميز',
    'common.freeDelivery': 'توصيل مجاني',
    'common.sellingFast': 'ينفد بسرعة',
    'common.priority': 'أولوية',
    'common.saveItem': 'حفظ المنتج',
    'common.addedToWishlist': 'تمت الإضافة إلى المفضلة',
    'common.removedFromWishlist': 'تمت الإزالة من المفضلة',
    'common.wishlistUpdateFailed': 'تعذر تحديث المفضلة',

    'cart.items': 'المنتجات',
    'cart.shippingAndHandling': 'الشحن والتجهيز',
    'cart.free': 'مجاني',
    'cart.total': 'الإجمالي',
    'cart.continueShopping': 'متابعة التسوق',
    'cart.checkout': 'إتمام الشراء',
    'cart.checkoutUnavailable': 'الدفع غير متاح',

    'footer.shop': 'تسوق',
    'footer.allProducts': 'كل المنتجات',
    'footer.topSelling': 'الأكثر مبيعًا',
    'footer.newArrivals': 'وصل حديثًا',
    'footer.categories': 'الفئات',
    'footer.customerCare': 'خدمة العملاء',
    'footer.trackOrder': 'تتبع الطلب',
    'footer.myOrders': 'طلباتي',
    'footer.myWishlist': 'مفضلتي',
    'footer.faq': 'الأسئلة الشائعة',
    'footer.support': 'الدعم',
    'footer.legalInfo': 'القانونية والمعلومات',
    'footer.termsAndConditions': 'الشروط والأحكام',
    'footer.termsOfSale': 'شروط البيع',
    'footer.shippingPolicy': 'سياسة الشحن',
    'footer.privacyPolicy': 'سياسة الخصوصية',
    'footer.cancellationRefunds': 'الإلغاء والاسترجاع',
    'footer.contactUs': 'اتصل بنا',
    'footer.sitemap': 'خريطة الموقع',
    'footer.aboutStore': 'عن Store1920',
    'footer.aboutUs': 'من نحن',
    'footer.createYourStore': 'أنشئ متجرك',
    'footer.becomeSeller': 'كن بائعًا',
    'footer.careers': 'الوظائف',
    'footer.description': 'وجهتك المفضلة لأحدث الأجهزة والإلكترونيات مع منتجات موثوقة وتوصيل سريع وخدمة مميزة.',
    'footer.uae': 'الإمارات العربية المتحدة',
    'footer.allRightsReserved': 'جميع الحقوق محفوظة.',

    'featured.title': 'منتجات مختارة',
    'featured.description': 'اختيارات منتقاة خصيصًا لك',
    'featured.empty': 'لا توجد منتجات مختارة حتى الآن.',

    'navbar.deliverTo': 'التوصيل إلى',
    'navbar.signInToChoose': 'سجّل الدخول للاختيار',
    'navbar.selectAddress': 'اختر العنوان',
    'navbar.addAddress': 'أضف عنوانًا',
    'navbar.searchFragrances': 'ابحث عن "عطور"',
    'navbar.dashboard': 'لوحة التحكم',
    'navbar.sellerDashboard': 'لوحة تحكم البائع',
    'navbar.profile': 'الملف الشخصي',
    'navbar.orders': 'الطلبات',
    'navbar.wishlist': 'المفضلة',
    'navbar.addresses': 'العناوين',
    'navbar.accountSettings': 'إعدادات الحساب',
    'navbar.signOut': 'تسجيل الخروج',
    'navbar.signInRegister': 'تسجيل الدخول / إنشاء حساب',
    'navbar.support': 'الدعم',
    'navbar.faq': 'الأسئلة الشائعة',
    'navbar.termsAndConditions': 'الشروط والأحكام',
    'navbar.privacyPolicy': 'سياسة الخصوصية',
    'navbar.returnPolicy': 'سياسة الإرجاع',
    'navbar.language': 'اللغة',
    'navbar.shopIn': 'تسوّق في',
    'navbar.currency': 'العملة',
    'navbar.shoppingIn': 'أنت تتسوّق في {country}.',
    'navbar.cart': 'السلة',
    'navbar.myOrders': 'طلباتي',
    'navbar.browseHistory': 'سجل التصفح',
    'navbar.topSellingItems': 'الأكثر مبيعًا',
    'navbar.newArrivals': 'وصل حديثًا',
    'navbar.fiveStarRated': 'تقييم 5 نجوم',
    'navbar.fastDelivery': 'توصيل سريع',
    'navbar.login': 'تسجيل الدخول',
    'navbar.signUp': 'إنشاء حساب',
    'navbar.wallet': 'المحفظة',
    'navbar.emptyCartToast': 'سلتك فارغة. أضف بعض المنتجات أولاً.',
    'navbar.readyToSignOut': 'هل تريد تسجيل الخروج؟',
    'navbar.saveCartWishlist': 'سنحفظ السلة والمفضلة لتعود إليهما في أي وقت.',
    'navbar.staySignedIn': 'البقاء مسجلاً',
    'navbar.hiUser': 'مرحبًا، {name}',

    'product.loading': 'جارٍ تحميل المنتج…',
    'product.notFound': 'المنتج غير موجود.',
    'product.used': 'مستعمل',
    'product.shareTo': 'مشاركة إلى',
    'product.itemId': 'رقم المنتج:',
    'product.soldCount': '{count} مباعة',
    'product.soldBy': 'يباع بواسطة',
    'product.limitedStockAvailable': 'كمية محدودة: متوفر {count}',
    'product.limitedTime': 'لفترة محدودة',
    'product.almostSoldOut': 'قارب على النفاد',
    'product.installments': '4 دفعات بدون فوائد بقيمة {amount} مع',
    'product.color': 'اللون',
    'product.size': 'المقاس',
    'product.outLabel': 'نفد',
    'product.bundleAndSave': 'وفّر أكثر مع الباقات!',
    'product.mostPopular': 'الأكثر طلبًا',
    'product.perfectFor2Pack': 'مناسب لعبوتين',
    'product.bestValue': 'أفضل قيمة',
    'product.buy1': 'اشترِ 1',
    'product.bundleOf': 'باقة من {qty}',
    'product.qty': 'الكمية',
    'product.discountAddToCart': 'خصم {discount}% الآن! أضف إلى السلة',
  },
};

const interpolate = (template, replacements = {}) => {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(replacements, key)) {
      return String(replacements[key]);
    }
    return `{${key}}`;
  });
};

export function translateStaticText(key, language = 'en', replacements = {}) {
  const message = STATIC_TRANSLATIONS[language]?.[key] ?? STATIC_TRANSLATIONS.en?.[key];
  if (!message) return interpolate(key, replacements);
  return interpolate(message, replacements);
}

export function useStorefrontI18n() {
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const readLanguage = () => {
      try {
        const storedLanguage = window.localStorage.getItem(STOREFRONT_LANGUAGE_KEY);
        setLanguage(storedLanguage === 'ar' ? 'ar' : 'en');
      } catch {
        setLanguage('en');
      }
    };

    const handleLanguageChange = (event) => {
      const nextLanguage = event?.detail?.language;
      setLanguage(nextLanguage === 'ar' ? 'ar' : 'en');
    };

    const handleStorage = (event) => {
      if (!event || event.key === STOREFRONT_LANGUAGE_KEY) {
        readLanguage();
      }
    };

    readLanguage();
    window.addEventListener(STOREFRONT_LANGUAGE_EVENT, handleLanguageChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(STOREFRONT_LANGUAGE_EVENT, handleLanguageChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const translator = useMemo(() => {
    return (key, replacements = {}) => translateStaticText(key, language, replacements);
  }, [language]);

  return {
    language,
    isArabic: language === 'ar',
    t: translator,
  };
}