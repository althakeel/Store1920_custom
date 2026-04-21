"use client"
import { usePathname } from "next/navigation"
import { HomeIcon, LayoutListIcon, SquarePenIcon, SquarePlusIcon, StarIcon, FolderIcon, TicketIcon, TruckIcon, RefreshCw, User as UserIcon, Users as UsersIcon, MessageSquare, Sparkles, BellIcon, MailIcon, Image as ImageIcon, ShoppingCart, Wallet, BarChart3, Target, Gift, Palette } from "lucide-react"
import Link from "next/link"

const StoreSidebar = ({storeInfo}) => {
    const pathname = usePathname()

    const sidebarLinks = [
        { name: 'Dashboard', href: '/store', icon: HomeIcon },
        { name: 'Categories', href: '/store/categories', icon: FolderIcon },
        { name: 'Add Product', href: '/store/add-product', icon: SquarePlusIcon },
        { name: 'Manage Product', href: '/store/manage-product', icon: SquarePenIcon },
        { name: 'Database Import', href: '/store/settings/database-import', icon: RefreshCw },
        { name: 'Customize', href: '/store/customize', icon: Palette },
        { name: 'Promotional Offers', href: '/store/personalized-offers', icon: Gift },
        { name: 'Media', href: '/store/media', icon: ImageIcon },
        { name: 'Abandoned Checkout', href: '/store/abandoned-checkout', icon: ShoppingCart },
        { name: 'Coupons', href: '/store/coupons', icon: TicketIcon },
        { name: 'Shipping', href: '/store/shipping', icon: TruckIcon },
        { name: 'Customers', href: '/store/customers', icon: UsersIcon },
        { name: 'Manage Users', href: '/store/settings/users', icon: UserIcon },
        { name: 'Orders', href: '/store/orders', icon: LayoutListIcon },
        { name: 'Balance', href: '/store/balance', icon: Wallet },
        { name: 'Sales Report', href: '/store/sales-report', icon: BarChart3 },
        { name: 'Marketing Expenses', href: '/store/marketing-expenses', icon: Target },
        { name: 'Return Requests', href: '/store/return-requests', icon: RefreshCw },
        { name: 'Reviews', href: '/store/reviews', icon: StarIcon },
        { name: 'Support Tickets', href: '/store/tickets', icon: MessageSquare },
        { name: 'Contact Us Messages', href: '/store#contact-messages', icon: StarIcon },
        { name: 'Product Notifications', href: '/store/product-notifications', icon: BellIcon },
        { name: 'Promotional Emails', href: '/store/promotional-emails', icon: MailIcon },
        { name: 'Ad Tracking', href: '/store/ads-tracking', icon: BarChart3 },
    ]

    const sidebarSections = [
        {
            name: 'Core',
            links: [
                '/store',
                '/store/categories',
                '/store/add-product',
                '/store/manage-product',
                '/store/settings/database-import',
            ]
        },
        {
            name: 'Storefront',
            links: [
                '/store/customize',
                '/store/media',
            ]
        },
        {
            name: 'Marketing',
            links: [
                '/store/personalized-offers',
                '/store/coupons',
                '/store/promotional-emails',
                '/store/ads-tracking',
                '/store/marketing-expenses',
            ]
        },
        {
            name: 'Sales & Operations',
            links: [
                '/store/orders',
                '/store/abandoned-checkout',
                '/store/shipping',
                '/store/return-requests',
                '/store/balance',
                '/store/sales-report',
            ]
        },
        {
            name: 'Customers & Support',
            links: [
                '/store/customers',
                '/store/settings/users',
                '/store/reviews',
                '/store/tickets',
                '/store/product-notifications',
                '/store#contact-messages',
            ]
        },
    ]

    const linkByHref = sidebarLinks.reduce((acc, link) => {
        acc[link.href] = link;
        return acc;
    }, {});

    const resolveActive = (href) => {
        if (href.includes('#')) {
            return pathname === href.split('#')[0];
        }
        return pathname === href;
    }

    const getSectionIcon = (sectionName) => {
        switch (sectionName) {
            case 'Core':
                return HomeIcon;
            case 'Storefront':
                return Sparkles;
            case 'Marketing':
                return Gift;
            case 'Sales & Operations':
                return LayoutListIcon;
            case 'Customers & Support':
                return UsersIcon;
            default:
                return LayoutListIcon;
        }
    }

    const getSectionTheme = (sectionName) => {
        switch (sectionName) {
            case 'Core':
                return {
                    headerText: 'text-sky-700',
                    headerIconBg: 'bg-sky-100',
                    headerIconText: 'text-sky-700',
                    activeLink: 'bg-sky-50 text-sky-700 border border-sky-200 shadow-sm font-semibold',
                    activeIconBg: 'bg-sky-100',
                    activeIconText: 'text-sky-700',
                    hoverLink: 'hover:bg-sky-50/60 hover:text-sky-700',
                    hoverIconBg: 'group-hover:bg-sky-100',
                    hoverIconText: 'group-hover:text-sky-700',
                    dot: 'bg-sky-600'
                }
            case 'Storefront':
                return {
                    headerText: 'text-emerald-700',
                    headerIconBg: 'bg-emerald-100',
                    headerIconText: 'text-emerald-700',
                    activeLink: 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm font-semibold',
                    activeIconBg: 'bg-emerald-100',
                    activeIconText: 'text-emerald-700',
                    hoverLink: 'hover:bg-emerald-50/60 hover:text-emerald-700',
                    hoverIconBg: 'group-hover:bg-emerald-100',
                    hoverIconText: 'group-hover:text-emerald-700',
                    dot: 'bg-emerald-600'
                }
            case 'Marketing':
                return {
                    headerText: 'text-violet-700',
                    headerIconBg: 'bg-violet-100',
                    headerIconText: 'text-violet-700',
                    activeLink: 'bg-violet-50 text-violet-700 border border-violet-200 shadow-sm font-semibold',
                    activeIconBg: 'bg-violet-100',
                    activeIconText: 'text-violet-700',
                    hoverLink: 'hover:bg-violet-50/60 hover:text-violet-700',
                    hoverIconBg: 'group-hover:bg-violet-100',
                    hoverIconText: 'group-hover:text-violet-700',
                    dot: 'bg-violet-600'
                }
            case 'Sales & Operations':
                return {
                    headerText: 'text-amber-700',
                    headerIconBg: 'bg-amber-100',
                    headerIconText: 'text-amber-700',
                    activeLink: 'bg-amber-50 text-amber-700 border border-amber-200 shadow-sm font-semibold',
                    activeIconBg: 'bg-amber-100',
                    activeIconText: 'text-amber-700',
                    hoverLink: 'hover:bg-amber-50/60 hover:text-amber-700',
                    hoverIconBg: 'group-hover:bg-amber-100',
                    hoverIconText: 'group-hover:text-amber-700',
                    dot: 'bg-amber-600'
                }
            case 'Customers & Support':
                return {
                    headerText: 'text-rose-700',
                    headerIconBg: 'bg-rose-100',
                    headerIconText: 'text-rose-700',
                    activeLink: 'bg-rose-50 text-rose-700 border border-rose-200 shadow-sm font-semibold',
                    activeIconBg: 'bg-rose-100',
                    activeIconText: 'text-rose-700',
                    hoverLink: 'hover:bg-rose-50/60 hover:text-rose-700',
                    hoverIconBg: 'group-hover:bg-rose-100',
                    hoverIconText: 'group-hover:text-rose-700',
                    dot: 'bg-rose-600'
                }
            default:
                return {
                    headerText: 'text-slate-600',
                    headerIconBg: 'bg-slate-100',
                    headerIconText: 'text-slate-700',
                    activeLink: 'bg-slate-100 text-slate-800 border border-slate-200 shadow-sm font-semibold',
                    activeIconBg: 'bg-slate-200',
                    activeIconText: 'text-slate-800',
                    hoverLink: 'hover:bg-slate-100 hover:text-slate-700',
                    hoverIconBg: 'group-hover:bg-slate-200',
                    hoverIconText: 'group-hover:text-slate-700',
                    dot: 'bg-slate-600'
                }
        }
    }

    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className="w-72 bg-gradient-to-br from-slate-50 via-white to-slate-50 border-r border-slate-200 flex flex-col overflow-hidden shadow-lg">
                
           
          
           
                {/* Navigation Links */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4">
                    {/* Sectioned Navigation */}
                    {sidebarSections.map((section) => {
                        const SectionIcon = getSectionIcon(section.name)
                        const theme = getSectionTheme(section.name)

                        return (
                            <div key={section.name} className="mt-6">
                                <div className={`px-3 pb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${theme.headerText}`}>
                                    <span className={`p-1 rounded-md ${theme.headerIconBg}`}>
                                        <SectionIcon size={12} className={theme.headerIconText} />
                                    </span>
                                    <span>{section.name}</span>
                                </div>

                                <div className="space-y-1">
                                    {section.links.map((href) => {
                                            const link = linkByHref[href]
                                            if (!link) return null

                                            const Icon = link.icon
                                            const isActive = resolveActive(link.href)
                                            return (
                                                <Link
                                                    key={`${section.name}-${link.href}`}
                                                    href={link.href}
                                                    className={`group flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all duration-200 ${
                                                        isActive
                                                            ? `${theme.activeLink} scale-[1.01]`
                                                            : `text-slate-700 ${theme.hoverLink} hover:shadow-sm`
                                                    }`}
                                                >
                                                    <div className={`p-1.5 rounded-lg transition-colors ${
                                                        isActive 
                                                            ? `${theme.activeIconBg}`
                                                            : `bg-slate-100 ${theme.hoverIconBg}`
                                                    }`}>
                                                        <Icon size={18} className={isActive ? theme.activeIconText : `text-slate-600 ${theme.hoverIconText}`} />
                                                    </div>
                                                    <span className="flex-1">{link.name}</span>
                                                    {isActive && (
                                                        <div className={`w-1.5 h-1.5 rounded-full ${theme.dot} animate-pulse`}></div>
                                                    )}
                                                </Link>
                                            )
                                        })}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Settings Button */}
                <div className="border-t border-slate-200 px-3 py-4 bg-slate-50/50">
                    <Link
                        href="/store/settings"
                        className="group flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-xl hover:from-slate-600 hover:to-slate-500 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] font-medium"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Settings</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default StoreSidebar
