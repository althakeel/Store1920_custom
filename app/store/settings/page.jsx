"use client"
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import axios from "axios";

const SIDEBAR_ACCESS_COMPONENTS = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/store' },
    { id: 'categories', label: 'Categories', icon: '📂', href: '/store/categories' },
    { id: 'addProduct', label: 'Add Product', icon: '➕', href: '/store/add-product' },
    { id: 'manageProduct', label: 'Manage Product', icon: '🧾', href: '/store/manage-product' },
    { id: 'databaseImport', label: 'Database Import', icon: '🗄️', href: '/store/settings/database-import' },
    { id: 'customize', label: 'Customize', icon: '🎨', href: '/store/customize' },
    { id: 'promotionalOffers', label: 'Promotional Offers', icon: '🎁', href: '/store/personalized-offers' },
    { id: 'media', label: 'Media', icon: '🖼️', href: '/store/media' },
    { id: 'abandonedCheckout', label: 'Abandoned Checkout', icon: '🛒', href: '/store/abandoned-checkout' },
    { id: 'coupons', label: 'Coupons', icon: '🏷️', href: '/store/coupons' },
    { id: 'shipping', label: 'Shipping', icon: '🚚', href: '/store/shipping' },
    { id: 'customers', label: 'Customers', icon: '👥', href: '/store/customers' },
    { id: 'manageUsers', label: 'Manage Users', icon: '👤', href: '/store/settings/users' },
    { id: 'orders', label: 'Orders', icon: '📦', href: '/store/orders' },
    { id: 'balance', label: 'Balance', icon: '💰', href: '/store/balance' },
    { id: 'salesReport', label: 'Sales Report', icon: '📊', href: '/store/sales-report' },
    { id: 'marketingExpenses', label: 'Marketing Expenses', icon: '📉', href: '/store/marketing-expenses' },
    { id: 'returnRequests', label: 'Return Requests', icon: '↩️', href: '/store/return-requests' },
    { id: 'reviews', label: 'Reviews', icon: '⭐', href: '/store/reviews' },
    { id: 'supportTickets', label: 'Support Tickets', icon: '🎫', href: '/store/tickets' },
    { id: 'contactMessages', label: 'Contact Messages', icon: '✉️', href: '/store#contact-messages' },
    { id: 'productNotifications', label: 'Product Notifications', icon: '🔔', href: '/store/product-notifications' },
    { id: 'promotionalEmails', label: 'Promotional Emails', icon: '📧', href: '/store/promotional-emails' },
    { id: 'adsTracking', label: 'Ad Tracking', icon: '📈', href: '/store/ads-tracking' },
]

const getDefaultPermissions = () => {
    const defaults = {}
    SIDEBAR_ACCESS_COMPONENTS.forEach((component) => {
        defaults[component.id] = true
    })
    return defaults
}

export default function SettingsPage() {
    const { user, getToken } = useAuth();
    const [activeTab, setActiveTab] = useState("profile");
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteStatus, setInviteStatus] = useState("");
    const [invitePermissions, setInvitePermissions] = useState(getDefaultPermissions());
    
    // Profile fields
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [image, setImage] = useState("");
    const [imageFile, setImageFile] = useState(null);
    
    // Store fields
    const [storeName, setStoreName] = useState("");
    const [storePhone, setStorePhone] = useState("");
    const [storeWebsite, setStoreWebsite] = useState("");
    const [storeAddress, setStoreAddress] = useState("");
    const [storeCity, setStoreCity] = useState("");
    const [storeState, setStoreState] = useState("");
    const [storeZip, setStoreZip] = useState("");
    const [storeDescription, setStoreDescription] = useState("");
    const [businessType, setBusinessType] = useState("");
    
    // Settings fields
    const [emailNotifications, setEmailNotifications] = useState(true);
    
    // Dashboard Access fields
    const [teamMembers, setTeamMembers] = useState([]);
    const [memberPermissions, setMemberPermissions] = useState({});
    
    const dashboardComponents = SIDEBAR_ACCESS_COMPONENTS;
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [currencyPreference, setCurrencyPreference] = useState("INR");
    const [transactionalSmtp, setTransactionalSmtp] = useState({ host: '', port: 465, user: '', pass: '', secure: true, fromEmail: '', fromName: '' });
    const [promotionalSmtp, setPromotionalSmtp] = useState({ host: '', port: 465, user: '', pass: '', secure: true, fromEmail: '', fromName: '' });
    
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [loadingTeam, setLoadingTeam] = useState(false);

    // Populate fields when user is loaded or changes
    useEffect(() => {
        setName(user?.displayName || user?.name || "");
        setEmail(user?.email || "");
        setImage(user?.photoURL || user?.image || "");
    }, [user]);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const token = await getToken();
                if (!token) return;
                const res = await axios.get('/api/store/profile/update', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const profile = res.data?.profile || {};
                const store = res.data?.store || {};
                const smtp = res.data?.smtpSettings || {};

                if (profile.name) setName(profile.name);
                if (profile.email) setEmail(profile.email);
                if (profile.image) setImage(profile.image);

                setStoreName(store.storeName || '');
                setStorePhone(store.storePhone || '');
                setStoreWebsite(store.storeWebsite || '');
                setStoreAddress(store.storeAddress || '');
                setStoreDescription(store.storeDescription || '');

                setTransactionalSmtp({
                    host: smtp?.transactional?.host || '',
                    port: Number(smtp?.transactional?.port || 465),
                    user: smtp?.transactional?.user || '',
                    pass: smtp?.transactional?.pass || '',
                    secure: typeof smtp?.transactional?.secure === 'boolean' ? smtp.transactional.secure : true,
                    fromEmail: smtp?.transactional?.fromEmail || '',
                    fromName: smtp?.transactional?.fromName || '',
                });

                setPromotionalSmtp({
                    host: smtp?.promotional?.host || '',
                    port: Number(smtp?.promotional?.port || 465),
                    user: smtp?.promotional?.user || '',
                    pass: smtp?.promotional?.pass || '',
                    secure: typeof smtp?.promotional?.secure === 'boolean' ? smtp.promotional.secure : true,
                    fromEmail: smtp?.promotional?.fromEmail || '',
                    fromName: smtp?.promotional?.fromName || '',
                });
            } catch {
                // Keep UI usable even if settings preload fails.
            }
        };

        if (user) {
            loadSettings();
        }
    }, [user, getToken]);
    
    // Fetch team members when Dashboard Access tab is active
    useEffect(() => {
        if (activeTab === "dashboardAccess") {
            const fetchTeamMembers = async () => {
                setLoadingTeam(true);
                try {
                    const token = await getToken();
                    const res = await axios.get("/api/store/users", {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    console.log("Team members fetched:", res.data);
                    setTeamMembers(res.data.users || []);
                    // Initialize permissions for each member
                    const permissions = {};
                    res.data.users?.forEach(member => {
                        permissions[member.id] = {
                            ...getDefaultPermissions(),
                            ...(member.permissions || {}),
                        };
                    });
                    setMemberPermissions(permissions);
                } catch (err) {
                    console.error('Failed to fetch team members:', err);
                    setMessage('Failed to load team members');
                } finally {
                    setLoadingTeam(false);
                }
            };
            fetchTeamMembers();
        }
    }, [activeTab, getToken]);

    // Live preview for uploaded image, fallback to current or first letter avatar
    let imagePreview = null;
    if (imageFile) {
        imagePreview = URL.createObjectURL(imageFile);
    } else if (image) {
        imagePreview = image;
    }

    const handleSaveChanges = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage("");
        try {
            const token = await getToken();
            let imageUrl = image;
            if (imageFile) {
                const formData = new FormData();
                formData.append("image", imageFile);
                const res = await axios.post("/api/store/profile/upload-image", formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                imageUrl = res.data.url;
            }
            
            const dataToSave = {
                name, 
                image: imageUrl, 
                email,
                storeName,
                storePhone,
                storeWebsite,
                storeAddress,
                storeCity,
                storeState,
                storeZip,
                storeDescription,
                businessType,
                emailNotifications,
                twoFactorEnabled,
                currencyPreference,
                smtpSettings: {
                    transactional: {
                        host: transactionalSmtp.host,
                        port: Number(transactionalSmtp.port || 465),
                        user: transactionalSmtp.user,
                        pass: transactionalSmtp.pass,
                        secure: Boolean(transactionalSmtp.secure),
                        fromEmail: transactionalSmtp.fromEmail,
                        fromName: transactionalSmtp.fromName,
                    },
                    promotional: {
                        host: promotionalSmtp.host,
                        port: Number(promotionalSmtp.port || 465),
                        user: promotionalSmtp.user,
                        pass: promotionalSmtp.pass,
                        secure: Boolean(promotionalSmtp.secure),
                        fromEmail: promotionalSmtp.fromEmail,
                        fromName: promotionalSmtp.fromName,
                    }
                }
            };
            
            await axios.post("/api/store/profile/update", dataToSave, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage("Settings saved successfully!");
            setImage(imageUrl);
            setImageFile(null);
        } catch (err) {
            setMessage(err?.response?.data?.error || err.message);
        }
        setSaving(false);
    };

    return (
        <div className="flex flex-col gap-0 h-screen max-h-screen overflow-hidden bg-white">
            {/* Header */}
            <div className="border-b border-slate-200 px-6 py-4 bg-white">
                <h2 className="text-2xl font-semibold text-slate-900">Settings</h2>
                <p className="text-sm text-slate-500">Manage your store and account preferences</p>
                <div className="mt-3">
                    <a
                        href="/store/settings/database-import"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                        Open Database Import Settings
                    </a>
                </div>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-0 border-b border-slate-200 px-6 bg-slate-50 overflow-x-auto">
                {["profile", "store", "preferences", "dashboardAccess", "dataImport"].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-3 font-medium text-sm transition border-b-2 whitespace-nowrap ${
                            activeTab === tab 
                                ? 'text-blue-600 border-blue-600' 
                                : 'text-slate-600 border-transparent hover:text-slate-800'
                        }`}
                    >
                        {tab === "dashboardAccess" ? "Dashboard Access" : tab === "dataImport" ? "Data Import" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <form onSubmit={handleSaveChanges} className="flex flex-col gap-6 p-6">
                    
                    {/* Profile Tab */}
                    {activeTab === "profile" && (
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col items-center gap-3 mb-4">
                                <div className="relative w-20 h-20">
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-blue-200" />
                                    ) : (
                                        <span className="w-20 h-20 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-2xl border-2 border-blue-200">
                                            {(name?.[0] || email?.[0] || 'U').toUpperCase()}
                                        </span>
                                    )}
                                    <label className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-1.5 cursor-pointer shadow-lg hover:bg-blue-700">
                                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                                            if (e.target.files && e.target.files[0]) setImageFile(e.target.files[0]);
                                        }} />
                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 4v16m-8-8h16"/></svg>
                                    </label>
                                </div>
                                <div className="text-center">
                                    <div className="font-semibold text-slate-900">{name || "Your Name"}</div>
                                    <div className="text-slate-500 text-sm">{email || "your@email.com"}</div>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <label className="flex flex-col gap-1.5">
                                    <span className="font-medium text-slate-700">Full Name</span>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="font-medium text-slate-700">Email Address</span>
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
                                </label>
                            </div>
                        </div>
                    )}
                    
                    {/* Store Tab */}
                    {activeTab === "store" && (
                        <div className="space-y-4">
                            <label className="flex flex-col gap-1.5">
                                <span className="font-medium text-slate-700">Store Name</span>
                                <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Your store name" />
                            </label>
                            
                            <label className="flex flex-col gap-1.5">
                                <span className="font-medium text-slate-700">Business Type</span>
                                <select value={businessType} onChange={e => setBusinessType(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                    <option value="">Select business type</option>
                                    <option value="retail">Retail</option>
                                    <option value="wholesale">Wholesale</option>
                                    <option value="service">Service</option>
                                    <option value="digital">Digital Products</option>
                                    <option value="other">Other</option>
                                </select>
                            </label>
                            
                            <label className="flex flex-col gap-1.5">
                                <span className="font-medium text-slate-700">Phone Number</span>
                                <input type="tel" value={storePhone} onChange={e => setStorePhone(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="+91 XXXXX XXXXX" />
                            </label>
                            
                            <label className="flex flex-col gap-1.5">
                                <span className="font-medium text-slate-700">Website URL</span>
                                <input type="url" value={storeWebsite} onChange={e => setStoreWebsite(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="https://example.com" />
                            </label>
                            
                            <label className="flex flex-col gap-1.5">
                                <span className="font-medium text-slate-700">Description</span>
                                <textarea value={storeDescription} onChange={e => setStoreDescription(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" rows="3" placeholder="Tell customers about your store..." />
                            </label>
                            
                            <div className="border-t border-slate-200 pt-4">
                                <h3 className="font-medium text-slate-700 mb-3">Address</h3>
                                <div className="space-y-3">
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-sm text-slate-700">Street Address</span>
                                        <input type="text" value={storeAddress} onChange={e => setStoreAddress(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="123 Main Street" />
                                    </label>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">City</span>
                                            <input type="text" value={storeCity} onChange={e => setStoreCity(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="City" />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">State</span>
                                            <input type="text" value={storeState} onChange={e => setStoreState(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="State" />
                                        </label>
                                    </div>
                                    
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-sm text-slate-700">ZIP Code</span>
                                        <input type="text" value={storeZip} onChange={e => setStoreZip(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="123456" />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Preferences Tab */}
                    {activeTab === "preferences" && (
                        <div className="space-y-4">
                            <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-slate-700">Email Notifications</p>
                                        <p className="text-sm text-slate-500">Receive updates about orders and promotions</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={emailNotifications} onChange={e => setEmailNotifications(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-slate-700">Two-Factor Authentication</p>
                                        <p className="text-sm text-slate-500">Add extra security to your account</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={twoFactorEnabled} onChange={e => setTwoFactorEnabled(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                            
                            <label className="flex flex-col gap-1.5">
                                <span className="font-medium text-slate-700">Currency Preference</span>
                                <select value={currencyPreference} onChange={e => setCurrencyPreference(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                    <option value="INR">Indian Rupee (AED)</option>
                                    <option value="USD">US Dollar ($)</option>
                                    <option value="EUR">Euro (€)</option>
                                    <option value="GBP">British Pound (£)</option>
                                    <option value="AED">UAE Dirham (د.إ)</option>
                                </select>
                            </label>
                            
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-900">
                                    <span className="font-semibold">Account Status:</span> Active ✓
                                </p>
                                <p className="text-xs text-blue-700 mt-1">Last login: Today at 2:30 PM</p>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                                <h3 className="font-semibold text-slate-900">SMTP Email Settings</h3>
                                <p className="text-xs text-slate-600">Configure separate SMTP settings for no-reply (transactional) and promotional emails.</p>

                                <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                                    <h4 className="text-sm font-semibold text-slate-800">No-Reply / Transactional SMTP</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">SMTP Host</span>
                                            <input type="text" value={transactionalSmtp.host} onChange={e => setTransactionalSmtp(prev => ({ ...prev, host: e.target.value }))} className="border border-slate-300 p-2.5 rounded-lg" placeholder="smtp.hostinger.com" />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">SMTP Port</span>
                                            <input type="number" value={transactionalSmtp.port} onChange={e => setTransactionalSmtp(prev => ({ ...prev, port: Number(e.target.value || 465) }))} className="border border-slate-300 p-2.5 rounded-lg" placeholder="465" />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">SMTP User</span>
                                            <input type="text" value={transactionalSmtp.user} onChange={e => setTransactionalSmtp(prev => ({ ...prev, user: e.target.value }))} className="border border-slate-300 p-2.5 rounded-lg" placeholder="noreply@yourdomain.com" />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">SMTP Password</span>
                                            <input type="password" value={transactionalSmtp.pass} onChange={e => setTransactionalSmtp(prev => ({ ...prev, pass: e.target.value }))} className="border border-slate-300 p-2.5 rounded-lg" placeholder="Enter SMTP password" />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">From Email</span>
                                            <input type="email" value={transactionalSmtp.fromEmail} onChange={e => setTransactionalSmtp(prev => ({ ...prev, fromEmail: e.target.value }))} className="border border-slate-300 p-2.5 rounded-lg" placeholder="noreply@yourdomain.com" />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">From Name</span>
                                            <input type="text" value={transactionalSmtp.fromName} onChange={e => setTransactionalSmtp(prev => ({ ...prev, fromName: e.target.value }))} className="border border-slate-300 p-2.5 rounded-lg" placeholder="Store1920" />
                                        </label>
                                    </div>
                                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                        <input type="checkbox" checked={transactionalSmtp.secure} onChange={e => setTransactionalSmtp(prev => ({ ...prev, secure: e.target.checked }))} className="w-4 h-4" />
                                        Use secure TLS/SSL
                                    </label>
                                </div>

                                <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                                    <h4 className="text-sm font-semibold text-slate-800">Promotional SMTP</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">SMTP Host</span>
                                            <input type="text" value={promotionalSmtp.host} onChange={e => setPromotionalSmtp(prev => ({ ...prev, host: e.target.value }))} className="border border-slate-300 p-2.5 rounded-lg" placeholder="smtp.hostinger.com" />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">SMTP Port</span>
                                            <input type="number" value={promotionalSmtp.port} onChange={e => setPromotionalSmtp(prev => ({ ...prev, port: Number(e.target.value || 465) }))} className="border border-slate-300 p-2.5 rounded-lg" placeholder="465" />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">SMTP User</span>
                                            <input type="text" value={promotionalSmtp.user} onChange={e => setPromotionalSmtp(prev => ({ ...prev, user: e.target.value }))} className="border border-slate-300 p-2.5 rounded-lg" placeholder="marketing@yourdomain.com" />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">SMTP Password</span>
                                            <input type="password" value={promotionalSmtp.pass} onChange={e => setPromotionalSmtp(prev => ({ ...prev, pass: e.target.value }))} className="border border-slate-300 p-2.5 rounded-lg" placeholder="Enter SMTP password" />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">From Email</span>
                                            <input type="email" value={promotionalSmtp.fromEmail} onChange={e => setPromotionalSmtp(prev => ({ ...prev, fromEmail: e.target.value }))} className="border border-slate-300 p-2.5 rounded-lg" placeholder="marketing@yourdomain.com" />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-sm text-slate-700">From Name</span>
                                            <input type="text" value={promotionalSmtp.fromName} onChange={e => setPromotionalSmtp(prev => ({ ...prev, fromName: e.target.value }))} className="border border-slate-300 p-2.5 rounded-lg" placeholder="Store1920 Marketing" />
                                        </label>
                                    </div>
                                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                        <input type="checkbox" checked={promotionalSmtp.secure} onChange={e => setPromotionalSmtp(prev => ({ ...prev, secure: e.target.checked }))} className="w-4 h-4" />
                                        Use secure TLS/SSL
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Dashboard Access Tab */}
                    {activeTab === "dashboardAccess" && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <p className="text-sm text-blue-900">
                                    <span className="font-semibold">💡 Manage Permissions:</span> Control which dashboard components each team member can access.
                                </p>
                            </div>
                            
                            {/* Team Members Permissions */}
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-3">Team Member Access</h3>
                                {loadingTeam ? (
                                    <div className="bg-slate-100 rounded-lg p-6 text-center text-slate-600">
                                        <p className="text-sm">Loading team members...</p>
                                    </div>
                                ) : teamMembers.length === 0 ? (
                                    <div className="bg-slate-100 rounded-lg p-6 text-center text-slate-600">
                                        <p className="text-sm">No team members yet. Invite users to manage their access.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {teamMembers.map(member => (
                                            <div key={member.id} className="border border-slate-200 rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div>
                                                        <p className="font-medium text-slate-900">{member.name || member.email}</p>
                                                        <p className="text-xs text-slate-500">{member.email}</p>
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded-full ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {member.role || 'member'}
                                                    </span>
                                                </div>
                                                
                                                {/* Component Permissions */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {dashboardComponents.map(component => (
                                                        <label key={component.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={memberPermissions[member.id]?.[component.id] ?? true}
                                                                onChange={(e) => {
                                                                    setMemberPermissions(prev => ({
                                                                        ...prev,
                                                                        [member.id]: {
                                                                            ...prev[member.id],
                                                                            [component.id]: e.target.checked
                                                                        }
                                                                    }));
                                                                }}
                                                                className="w-4 h-4"
                                                            />
                                                            <span className="text-sm leading-tight">
                                                                <span className="block">{component.icon} {component.label}</span>
                                                                <span className="block text-[11px] text-slate-500">{component.href}</span>
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                                
                                                <button 
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            const token = await getToken();
                                                            await axios.post('/api/store/users/update-permissions', {
                                                                userId: member.id,
                                                                permissions: memberPermissions[member.id]
                                                            }, {
                                                                headers: { Authorization: `Bearer ${token}` }
                                                            });
                                                            setMessage('Permissions updated successfully!');
                                                        } catch (err) {
                                                            setMessage(err?.response?.data?.error || 'Failed to update permissions');
                                                        }
                                                    }}
                                                    className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded transition"
                                                >
                                                    Save Permissions
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* Default Permissions for New Users */}
                            <div className="border-t border-slate-200 pt-4 mt-4">
                                <h3 className="font-semibold text-slate-900 mb-3">Default Permissions for New Team Members</h3>
                                <p className="text-xs text-slate-600 mb-3">Select which components new invited users will have access to by default:</p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-lg">
                                    {dashboardComponents.map(component => (
                                        <label key={component.id} className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={invitePermissions[component.id] ?? true}
                                                onChange={(e) => {
                                                    setInvitePermissions(prev => ({
                                                        ...prev,
                                                        [component.id]: e.target.checked
                                                    }));
                                                }}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm leading-tight">
                                                <span className="block">{component.icon} {component.label}</span>
                                                <span className="block text-[11px] text-slate-500">{component.href}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "dataImport" && (
                        <div className="space-y-4">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                <p className="text-sm text-emerald-900">
                                    <span className="font-semibold">Legacy Database Import:</span> Upload your old WordPress or WooCommerce SQL schema and configure migration settings for the new store database.
                                </p>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
                                <h3 className="font-semibold text-slate-900">Open the import settings screen</h3>
                                <p className="text-sm text-slate-600">
                                    The dedicated import page lets you upload a `.sql` file, preview detected tables, set the table prefix, and choose which data domains to migrate.
                                </p>
                                <a
                                    href="/store/settings/database-import"
                                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                                >
                                    Go to Database Import Settings
                                </a>
                            </div>
                        </div>
                    )}
                    
                    {/* Buttons */}
                    <div className="flex flex-col gap-2 pt-4 border-t border-slate-200">
                        {activeTab !== "dashboardAccess" && activeTab !== "dataImport" && (
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition" disabled={saving}>
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        )}
                        <button 
                            type="button" 
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg font-medium transition"
                            onClick={() => setInviteOpen(!inviteOpen)}
                        >
                            {inviteOpen ? "Cancel Invite" : "Invite User"}
                        </button>
                        {message && <div className={`text-center text-sm p-2 rounded ${message.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message}</div>}
                    </div>
                </form>
                
                {/* Invite Section */}
                {inviteOpen && (
                    <div className="border-t border-slate-200 p-6 bg-slate-50">
                        <h3 className="font-semibold text-slate-900 mb-4">Invite Team Member</h3>
                        <form
                            onSubmit={async e => {
                                e.preventDefault();
                                setInviteStatus("");
                                try {
                                    const token = await getToken();
                                    await axios.post("/api/store/users/invite", { 
                                        email: inviteEmail,
                                        permissions: invitePermissions
                                    }, {
                                        headers: { Authorization: `Bearer ${token}` }
                                    });
                                    setInviteStatus("Invitation sent!");
                                    setInviteEmail("");
                                    setTimeout(() => setInviteOpen(false), 1500);
                                } catch (err) {
                                    setInviteStatus(err?.response?.data?.error || err.message);
                                }
                            }}
                            className="flex flex-col gap-4"
                        >
                            <label className="flex flex-col gap-1.5">
                                <span className="font-medium text-slate-700 text-sm">Email Address</span>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    placeholder="Enter email address"
                                    className="border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </label>
                            
                            <div>
                                <p className="font-medium text-slate-700 text-sm mb-2">Dashboard Access Permissions:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-white p-3 rounded-lg border border-slate-200">
                                    {dashboardComponents.map(component => (
                                        <label key={component.id} className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={invitePermissions[component.id] ?? true}
                                                onChange={(e) => {
                                                    setInvitePermissions(prev => ({
                                                        ...prev,
                                                        [component.id]: e.target.checked
                                                    }));
                                                }}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-xs leading-tight">
                                                <span className="block">{component.icon} {component.label}</span>
                                                <span className="block text-[10px] text-slate-500">{component.href}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg font-medium transition">
                                Send Invitation
                            </button>
                            {inviteStatus && <div className={`text-center text-sm p-2 rounded ${inviteStatus.includes('sent') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{inviteStatus}</div>}
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
