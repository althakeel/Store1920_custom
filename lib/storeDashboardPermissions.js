export const SIDEBAR_ACCESS_COMPONENTS = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/store' },
    { id: 'categories', label: 'Categories', icon: '📂', href: '/store/categories' },
    { id: 'addProduct', label: 'Add Product', icon: '➕', href: '/store/add-product' },
    { id: 'manageProduct', label: 'Manage Product', icon: '🧾', href: '/store/manage-product' },
    { id: 'databaseImport', label: 'Database Import', icon: '🗄️', href: '/store/settings/database-import' },
    { id: 'customize', label: 'Customize', icon: '🎨', href: '/store/customize' },
    { id: 'media', label: 'Media', icon: '🖼️', href: '/store/media' },
    { id: 'orders', label: 'Orders', icon: '📦', href: '/store/orders' },
    { id: 'customers', label: 'Customers', icon: '👥', href: '/store/customers' },
    { id: 'abandonedCheckout', label: 'Abandoned Checkout', icon: '🛒', href: '/store/abandoned-checkout' },
    { id: 'shipping', label: 'Shipping', icon: '🚚', href: '/store/shipping' },
    { id: 'returnRequests', label: 'Return Requests', icon: '↩️', href: '/store/return-requests' },
    { id: 'balance', label: 'Balance', icon: '💰', href: '/store/balance' },
    { id: 'salesReport', label: 'Sales Report', icon: '📊', href: '/store/sales-report' },
    { id: 'promotionalOffers', label: 'Promotional Offers', icon: '🎁', href: '/store/personalized-offers' },
    { id: 'coupons', label: 'Coupons', icon: '🏷️', href: '/store/coupons' },
    { id: 'giveaways', label: 'Giveaways', icon: '🎁', href: '/store/giveaways' },
    { id: 'spinWheel', label: 'Spin Wheel', icon: '🎡', href: '/store/spin-wheel' },
    { id: 'promotionalEmails', label: 'Promotional Emails', icon: '📧', href: '/store/promotional-emails' },
    { id: 'adsTracking', label: 'Ad Tracking', icon: '📈', href: '/store/ads-tracking' },
    { id: 'marketingExpenses', label: 'Marketing Expenses', icon: '📉', href: '/store/marketing-expenses' },
    { id: 'reviews', label: 'Reviews', icon: '⭐', href: '/store/reviews' },
    { id: 'supportTickets', label: 'Support Tickets', icon: '🎫', href: '/store/tickets' },
    { id: 'contactMessages', label: 'Contact Messages', icon: '✉️', href: '/store#contact-messages' },
    { id: 'productNotifications', label: 'Product Notifications', icon: '🔔', href: '/store/product-notifications' },
    { id: 'manageUsers', label: 'Manage Users', icon: '👤', href: '/store/settings/users' },
];

export const PERMISSION_GROUPS = [
    {
        id: 'store',
        label: 'Store & catalog',
        componentIds: ['dashboard', 'categories', 'addProduct', 'manageProduct', 'databaseImport', 'customize', 'media'],
    },
    {
        id: 'sales',
        label: 'Orders & customers',
        componentIds: ['orders', 'customers', 'abandonedCheckout', 'shipping', 'returnRequests', 'balance', 'salesReport'],
    },
    {
        id: 'marketing',
        label: 'Marketing',
        componentIds: ['promotionalOffers', 'coupons', 'giveaways', 'spinWheel', 'promotionalEmails', 'adsTracking', 'marketingExpenses'],
    },
    {
        id: 'support',
        label: 'Support & reviews',
        componentIds: ['reviews', 'supportTickets', 'contactMessages', 'productNotifications'],
    },
    {
        id: 'team',
        label: 'Team',
        componentIds: ['manageUsers'],
    },
];

const componentMap = Object.fromEntries(
    SIDEBAR_ACCESS_COMPONENTS.map((component) => [component.id, component])
);

export function getDefaultPermissions() {
    const defaults = {};
    SIDEBAR_ACCESS_COMPONENTS.forEach((component) => {
        defaults[component.id] = true;
    });
    return defaults;
}

export function countEnabledPermissions(permissions = {}) {
    return SIDEBAR_ACCESS_COMPONENTS.filter((component) => permissions[component.id] !== false).length;
}

export function getComponentById(id) {
    return componentMap[id] || null;
}

export function setAllPermissions(current = {}, enabled) {
    const next = { ...current };
    SIDEBAR_ACCESS_COMPONENTS.forEach((component) => {
        next[component.id] = enabled;
    });
    return next;
}

export function setGroupPermissions(current = {}, componentIds = [], enabled) {
    const next = { ...current };
    componentIds.forEach((id) => {
        next[id] = enabled;
    });
    return next;
}
