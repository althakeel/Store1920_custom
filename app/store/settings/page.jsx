"use client"
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import axios from "axios";
import toast from "react-hot-toast";
import PermissionPicker from "@/components/store/PermissionPicker";
import {
    SIDEBAR_ACCESS_COMPONENTS,
    countEnabledPermissions,
    getDefaultPermissions,
} from "@/lib/storeDashboardPermissions";

export default function SettingsPage() {
    const { user, getToken } = useAuth();
    const [activeTab, setActiveTab] = useState("profile");
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteStatus, setInviteStatus] = useState("");
    const [inviteSuccess, setInviteSuccess] = useState(false);
    const [inviteSending, setInviteSending] = useState(false);
    const [inviteLink, setInviteLink] = useState("");
    const [invitePermissions, setInvitePermissions] = useState(getDefaultPermissions());
    const [createLoginOpen, setCreateLoginOpen] = useState(false);
    const [creatingLogin, setCreatingLogin] = useState(false);
    const [createLoginStatus, setCreateLoginStatus] = useState("");
    const [newTeamUser, setNewTeamUser] = useState({
        name: "",
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "member",
    });
    
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
    
    const [editingMemberId, setEditingMemberId] = useState(null);
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
    
    const fetchTeamMembers = async () => {
        setLoadingTeam(true);
        try {
            const token = await getToken();
            const res = await axios.get("/api/store/users", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTeamMembers(res.data.users || []);
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

    // Fetch team members when Dashboard Access tab is active
    useEffect(() => {
        if (activeTab === "dashboardAccess") {
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

    const handleCreateTeamLogin = async () => {
        setCreateLoginStatus("");
        setCreatingLogin(true);

        if (!newTeamUser.name.trim() || !newTeamUser.username.trim() || !newTeamUser.email.trim()) {
            setCreateLoginStatus("Name, username, and email are required.");
            setCreatingLogin(false);
            return;
        }

        const normalizedUsername = newTeamUser.username.trim().toLowerCase();
        if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
            setCreateLoginStatus("Username must be between 3 and 30 characters.");
            setCreatingLogin(false);
            return;
        }

        if (!/^[a-z0-9._-]+$/.test(normalizedUsername)) {
            setCreateLoginStatus("Username can only use letters, numbers, dots, underscores, and hyphens.");
            setCreatingLogin(false);
            return;
        }

        if (!newTeamUser.password || newTeamUser.password.length < 6) {
            setCreateLoginStatus("Password must be at least 6 characters.");
            setCreatingLogin(false);
            return;
        }

        if (newTeamUser.password !== newTeamUser.confirmPassword) {
            setCreateLoginStatus("Passwords do not match.");
            setCreatingLogin(false);
            return;
        }

        try {
            const token = await getToken();
            const response = await axios.post(
                "/api/store/users/create",
                {
                    name: newTeamUser.name,
                    username: newTeamUser.username,
                    email: newTeamUser.email,
                    password: newTeamUser.password,
                    role: newTeamUser.role,
                    permissions: invitePermissions,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setCreateLoginStatus(
                `${response.data.message} Share login at /store/login with username "${response.data.user?.username || newTeamUser.username}" or email "${newTeamUser.email}".`
            );
            setNewTeamUser({
                name: "",
                username: "",
                email: "",
                password: "",
                confirmPassword: "",
                role: "member",
            });
            await fetchTeamMembers();
        } catch (err) {
            setCreateLoginStatus(err?.response?.data?.error || err.message);
        } finally {
            setCreatingLogin(false);
        }
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
                        <div className="space-y-5">
                            <p className="text-sm text-slate-600">
                                Choose what new team members can see, then invite people or create a login for them.
                            </p>

                            <div className="rounded-lg border border-slate-200 bg-white p-4">
                                <h3 className="font-semibold text-slate-900">Default access for new members</h3>
                                <p className="mt-1 text-xs text-slate-500">
                                    Used for email invites and new username/password logins.
                                </p>
                                <div className="mt-4">
                                    <PermissionPicker
                                        value={invitePermissions}
                                        onChange={setInvitePermissions}
                                        compact
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-4">
                                    <h3 className="font-semibold text-slate-900">Invite by email</h3>
                                    <p className="mt-1 text-xs text-slate-500">Send a link so they can join with their Google account or email.</p>
                                    <form
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            setInviteStatus("");
                                            setInviteSuccess(false);
                                            setInviteLink("");
                                            setInviteSending(true);
                                            try {
                                                const token = await getToken();
                                                const { data } = await axios.post("/api/store/users/invite", {
                                                    email: inviteEmail,
                                                    permissions: invitePermissions,
                                                }, {
                                                    headers: { Authorization: `Bearer ${token}` },
                                                });

                                                if (data?.emailSent === false) {
                                                    const warningMessage = data?.warning || "Email could not be delivered.";
                                                    setInviteSuccess(false);
                                                    setInviteLink(data?.inviteUrl || "");
                                                    setInviteStatus(`${data?.message || "Invitation saved"}. ${warningMessage}`);
                                                    toast.error(warningMessage);
                                                    return;
                                                }

                                                const successMessage = data?.message || "Invitation sent successfully!";
                                                setInviteSuccess(true);
                                                setInviteLink("");
                                                setInviteStatus(successMessage);
                                                toast.success(successMessage);
                                                setInviteEmail("");
                                            } catch (err) {
                                                const errorMessage = err?.response?.data?.error || err.message || "Failed to send invitation";
                                                setInviteSuccess(false);
                                                setInviteStatus(errorMessage);
                                                toast.error(errorMessage);
                                            } finally {
                                                setInviteSending(false);
                                            }
                                        }}
                                        className="mt-4 space-y-3"
                                    >
                                        <input
                                            type="email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            placeholder="team@yourstore.com"
                                            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-orange-500"
                                            required
                                        />
                                        <button
                                            type="submit"
                                            disabled={inviteSending}
                                            className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                            {inviteSending ? "Sending..." : "Send invite"}
                                        </button>
                                        {inviteStatus ? (
                                            <div className={`rounded-lg border p-3 text-sm ${
                                                inviteSuccess
                                                    ? 'border-green-200 bg-green-50 text-green-800'
                                                    : 'border-amber-200 bg-amber-50 text-amber-900'
                                            }`}>
                                                {inviteSuccess ? `✓ ${inviteStatus}` : inviteStatus}
                                                {inviteLink ? (
                                                    <div className="mt-3 space-y-2">
                                                        <p className="text-xs">Share this link manually:</p>
                                                        <div className="flex flex-col gap-2 sm:flex-row">
                                                            <input
                                                                type="text"
                                                                readOnly
                                                                value={inviteLink}
                                                                className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(inviteLink);
                                                                    toast.success("Invite link copied");
                                                                }}
                                                                className="rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                                                            >
                                                                Copy link
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </form>
                                </div>

                                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="font-semibold text-slate-900">Create username login</h3>
                                            <p className="mt-1 text-xs text-slate-500">
                                                For staff who sign in at <span className="font-mono">/store/login</span>.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCreateLoginOpen((open) => !open);
                                                setCreateLoginStatus("");
                                            }}
                                            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                                        >
                                            {createLoginOpen ? "Close" : "Open form"}
                                        </button>
                                    </div>

                                    {createLoginOpen ? (
                                        <div className="mt-4 grid gap-3 rounded-lg border border-emerald-200 bg-white p-3 md:grid-cols-2">
                                            <input
                                                type="text"
                                                value={newTeamUser.name}
                                                onChange={(e) => setNewTeamUser((prev) => ({ ...prev, name: e.target.value }))}
                                                className="rounded-lg border border-slate-300 p-2.5 text-sm md:col-span-2"
                                                placeholder="Full name"
                                            />
                                            <input
                                                type="text"
                                                value={newTeamUser.username}
                                                onChange={(e) => setNewTeamUser((prev) => ({ ...prev, username: e.target.value.toLowerCase() }))}
                                                className="rounded-lg border border-slate-300 p-2.5 text-sm"
                                                placeholder="Username"
                                                autoComplete="off"
                                            />
                                            <input
                                                type="email"
                                                value={newTeamUser.email}
                                                onChange={(e) => setNewTeamUser((prev) => ({ ...prev, email: e.target.value }))}
                                                className="rounded-lg border border-slate-300 p-2.5 text-sm"
                                                placeholder="Email"
                                            />
                                            <select
                                                value={newTeamUser.role}
                                                onChange={(e) => setNewTeamUser((prev) => ({ ...prev, role: e.target.value }))}
                                                className="rounded-lg border border-slate-300 p-2.5 text-sm"
                                            >
                                                <option value="member">Member</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                            <input
                                                type="password"
                                                value={newTeamUser.password}
                                                onChange={(e) => setNewTeamUser((prev) => ({ ...prev, password: e.target.value }))}
                                                className="rounded-lg border border-slate-300 p-2.5 text-sm"
                                                placeholder="Password (min 6 chars)"
                                                minLength={6}
                                            />
                                            <input
                                                type="password"
                                                value={newTeamUser.confirmPassword}
                                                onChange={(e) => setNewTeamUser((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                                                className="rounded-lg border border-slate-300 p-2.5 text-sm"
                                                placeholder="Confirm password"
                                                minLength={6}
                                            />
                                            <div className="md:col-span-2 space-y-2">
                                                <button
                                                    type="button"
                                                    onClick={handleCreateTeamLogin}
                                                    disabled={creatingLogin}
                                                    className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {creatingLogin ? "Creating..." : "Create login"}
                                                </button>
                                                {createLoginStatus ? (
                                                    <div className={`rounded-lg p-2 text-sm ${
                                                        createLoginStatus.toLowerCase().includes('success') || createLoginStatus.toLowerCase().includes('share login')
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {createLoginStatus}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900">Team members</h3>
                                {loadingTeam ? (
                                    <div className="mt-3 rounded-lg bg-slate-100 p-4 text-center text-sm text-slate-600">
                                        Loading team members...
                                    </div>
                                ) : teamMembers.length === 0 ? (
                                    <div className="mt-3 rounded-lg bg-slate-100 p-4 text-center text-sm text-slate-600">
                                        No team members yet. Invite someone above.
                                    </div>
                                ) : (
                                    <div className="mt-3 space-y-3">
                                        {teamMembers.map((member) => {
                                            const memberPerms = memberPermissions[member.id] || {};
                                            const enabledCount = countEnabledPermissions(memberPerms);
                                            const isEditing = editingMemberId === member.id;

                                            return (
                                                <div key={member.id} className="rounded-lg border border-slate-200 p-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <div>
                                                            <p className="font-medium text-slate-900">{member.name || member.username || member.email}</p>
                                                            <p className="text-xs text-slate-500">
                                                                {member.username ? `@${member.username}` : ''}{member.username && member.email ? ' · ' : ''}{member.email}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                                                {enabledCount}/{SIDEBAR_ACCESS_COMPONENTS.length} areas
                                                            </span>
                                                            <span className={`rounded-full px-2 py-1 text-xs ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                {member.role || 'member'}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingMemberId(isEditing ? null : member.id)}
                                                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                                            >
                                                                {isEditing ? 'Hide' : 'Edit access'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {isEditing ? (
                                                        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                                                            <PermissionPicker
                                                                value={memberPerms}
                                                                onChange={(next) => {
                                                                    setMemberPermissions((prev) => ({
                                                                        ...prev,
                                                                        [member.id]: next,
                                                                    }));
                                                                }}
                                                                compact
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    try {
                                                                        const token = await getToken();
                                                                        await axios.post('/api/store/users/update-permissions', {
                                                                            userId: member.id,
                                                                            permissions: memberPermissions[member.id],
                                                                        }, {
                                                                            headers: { Authorization: `Bearer ${token}` },
                                                                        });
                                                                        setMessage('Permissions updated successfully!');
                                                                        toast.success('Permissions saved');
                                                                        setEditingMemberId(null);
                                                                    } catch (err) {
                                                                        setMessage(err?.response?.data?.error || 'Failed to update permissions');
                                                                        toast.error(err?.response?.data?.error || 'Failed to update permissions');
                                                                    }
                                                                }}
                                                                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                                                            >
                                                                Save access
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
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
                        {activeTab !== "dashboardAccess" && (
                            <button 
                                type="button" 
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg font-medium transition"
                                onClick={() => setInviteOpen(!inviteOpen)}
                            >
                                {inviteOpen ? "Cancel Invite" : "Invite User"}
                            </button>
                        )}
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
                                setInviteSuccess(false);
                                setInviteLink("");
                                setInviteSending(true);
                                try {
                                    const token = await getToken();
                                    const { data } = await axios.post("/api/store/users/invite", { 
                                        email: inviteEmail,
                                        permissions: invitePermissions
                                    }, {
                                        headers: { Authorization: `Bearer ${token}` }
                                    });

                                    if (data?.emailSent === false) {
                                        const warningMessage = data?.warning || "Email could not be delivered.";
                                        setInviteSuccess(false);
                                        setInviteLink(data?.inviteUrl || "");
                                        setInviteStatus(`${data?.message || "Invitation saved"}. ${warningMessage}`);
                                        toast.error(warningMessage);
                                        return;
                                    }

                                    const successMessage = data?.message || "Invitation sent successfully!";
                                    setInviteSuccess(true);
                                    setInviteLink("");
                                    setInviteStatus(successMessage);
                                    toast.success(successMessage);
                                    setInviteEmail("");
                                    setInvitePermissions(getDefaultPermissions());
                                } catch (err) {
                                    const errorMessage = err?.response?.data?.error || err.message || "Failed to send invitation";
                                    setInviteSuccess(false);
                                    setInviteStatus(errorMessage);
                                    toast.error(errorMessage);
                                } finally {
                                    setInviteSending(false);
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
                                <p className="font-medium text-slate-700 text-sm mb-2">Dashboard access</p>
                                <PermissionPicker
                                    value={invitePermissions}
                                    onChange={setInvitePermissions}
                                    compact
                                />
                            </div>
                            
                            <button
                                type="submit"
                                disabled={inviteSending}
                                className="bg-orange-500 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70 text-white px-4 py-2.5 rounded-lg font-medium transition"
                            >
                                {inviteSending ? "Sending..." : "Send Invitation"}
                            </button>
                            {inviteStatus && (
                                <div className={`text-left text-sm p-3 rounded-lg border ${
                                    inviteSuccess
                                        ? 'bg-green-50 text-green-800 border-green-200'
                                        : 'bg-amber-50 text-amber-900 border-amber-200'
                                }`}>
                                    {inviteSuccess ? `✓ ${inviteStatus}` : inviteStatus}
                                    {inviteLink ? (
                                        <div className="mt-3 space-y-2">
                                            <p className="text-xs text-amber-800">Share this invite link manually:</p>
                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={inviteLink}
                                                    className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(inviteLink);
                                                        toast.success("Invite link copied");
                                                    }}
                                                    className="rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                                                >
                                                    Copy link
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
