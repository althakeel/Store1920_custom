'use client'
import { addAddress, fetchAddress } from "@/lib/features/address/addressSlice"

import axios from "axios"
import { XIcon } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { toast } from "react-hot-toast"
import { useDispatch } from "react-redux"

import { useAuth } from '@/lib/useAuth';

const indianStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh" 
];
const uaeEmirates = [
    "Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"
];

const AddressModal = ({ open, setShowAddressModal, onAddressAdded, initialAddress = null, isEdit = false, onAddressUpdated, addressList = [], onSelectAddress, selectedAddressId }) => {
    const { user, getToken } = useAuth()
    const dispatch = useDispatch()
    const phoneInputRef = useRef(null)
    
    const [mode, setMode] = useState('select') // 'select' or 'form'
    const [editingAddress, setEditingAddress] = useState(null) // Track which address is being edited
    const [pincodeLoading, setPincodeLoading] = useState(false)
    const [pincodeError, setPincodeError] = useState('')
    
    console.log('🔵 AddressModal Props:', { open, addressListLength: addressList.length, mode, isEdit, selectedAddressId })

    const [address, setAddress] = useState({
        name: '',
        email: '',
        street: '',
        city: '',
        state: '',
        district: '',
        zip: '',
        country: 'United Arab Emirates',
        phone: '',
        phoneCode: '+971',
        alternatePhone: '',
        alternatePhoneCode: '+971',
        id: null,
    })
    
    // Set mode based on props
    useEffect(() => {
        if (open) {
            if (isEdit || addressList.length === 0) {
                setMode('form');
            } else {
                setMode('select');
                setEditingAddress(null); // Reset editing when opening in select mode
            }
        }
    }, [isEdit, addressList.length, open]);

    // Prefill when editing or reset when adding new
    useEffect(() => {
        const addressToEdit = editingAddress || initialAddress;
        console.log('📝 Address useEffect triggered:', { editingAddress: editingAddress?.name, initialAddress: initialAddress?.name, isEdit });
        if ((isEdit || editingAddress) && addressToEdit) {
            // Extract phone number without country code if present
            let phoneNumber = addressToEdit.phone || '';
            // If phone starts with +, remove country code part
            if (phoneNumber.startsWith('+')) {
                // Remove country code (everything before the actual number)
                phoneNumber = phoneNumber.replace(/^\+\d+/, '').trim();
            }
            
            setAddress({
                id: addressToEdit.id || addressToEdit._id || null,
                name: addressToEdit.name || '',
                email: addressToEdit.email || '',
                street: addressToEdit.street || '',
                city: addressToEdit.city || '',
                state: addressToEdit.state || '',
                district: addressToEdit.district || '',
                zip: addressToEdit.zip || '',
                country: addressToEdit.country || 'United Arab Emirates',
                phone: phoneNumber,
                phoneCode: addressToEdit.phoneCode || '+971',
                alternatePhone: addressToEdit.alternatePhone || '',
                alternatePhoneCode: addressToEdit.alternatePhoneCode || addressToEdit.phoneCode || '+971',
            })
        } else if (!isEdit && !editingAddress) {
            // Reset form when adding new address
            setAddress({
                name: '',
                email: '',
                street: '',
                city: '',
                state: '',
                district: '',
                zip: '',
                country: 'United Arab Emirates',
                phone: '',
                phoneCode: '+971',
                alternatePhone: '',
                alternatePhoneCode: '+971',
                id: null,
            })
        }
    }, [isEdit, initialAddress, editingAddress])

    const countries = [
        { name: 'United Arab Emirates', code: '+971' },
        { name: 'India', code: '+91' },
        { name: 'Saudi Arabia', code: '+966' },
        { name: 'Qatar', code: '+974' },
        { name: 'Kuwait', code: '+965' },
        { name: 'Bahrain', code: '+973' },
        { name: 'Oman', code: '+968' },
        { name: 'Pakistan', code: '+92' },
    ];

    const handleAddressChange = (e) => {
        const { name, value } = e.target
        if (name === 'country') {
            const selectedCountry = countries.find(c => c.name === value)
            setAddress({
                ...address,
                country: value,
                state: '',
                district: '',
                zip: '',
                phoneCode: selectedCountry?.code || '+971',
                alternatePhoneCode: selectedCountry?.code || '+971'
            })
            setPincodeError('')
        } else {
            setAddress({
                ...address,
                [name]: value
            })
        }
    }

    // Fetch pincode details from API
    const handlePincodeSearch = async (e) => {
        const rawValue = e.target.value;
        const pincode = address.country === 'India'
            ? rawValue.replace(/\D/g, '').slice(0, 6)
            : rawValue.slice(0, 12);

        setAddress({
            ...address,
            zip: pincode
        });

        if (address.country !== 'India') {
            setPincodeError('');
            return;
        }
        
        if (!pincode || pincode.length < 6) {
            setPincodeError('');
            return;
        }

        setPincodeLoading(true);
        setPincodeError('');
        
        try {
            // Using India Post API for pincode lookup
            const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
            const data = await response.json();
            
            if (data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
                const postOffice = data[0].PostOffice[0];
                
                // Auto-fill city, state, and district
                setAddress(prev => ({
                    ...prev,
                    city: postOffice.Block || postOffice.District || prev.city,
                    state: postOffice.State || prev.state,
                    district: postOffice.District || prev.district,
                    zip: pincode
                }));
                setPincodeError('');
            } else {
                setPincodeError('Pincode not found. Please enter a valid pincode.');
            }
        } catch (error) {
            console.error('Pincode fetch error:', error);
            setPincodeError('Unable to fetch pincode details. Please enter manually.');
        } finally {
            setPincodeLoading(false);
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (!user || !user.uid) {
                toast.error('User not authenticated. Please sign in again.');
                return;
            }

            // Clean and validate phone number
            const cleanedPhone = address.phone.replace(/[^0-9]/g, '');
            const cleanedAlternate = (address.alternatePhone || '').replace(/[^0-9]/g, '');
            
            if (!cleanedPhone || cleanedPhone.length < 7 || cleanedPhone.length > 15) {
                toast.error('Phone number must be between 7 and 15 digits');
                return;
            }

            if (cleanedAlternate && (cleanedAlternate.length < 7 || cleanedAlternate.length > 15)) {
                toast.error('Alternate number must be between 7 and 15 digits');
                return;
            }

            const normalizedZip = String(address.zip || '').replace(/\s/g, '');
            if (normalizedZip && /^0+$/.test(normalizedZip)) {
                toast.error('Please enter a valid pincode. All-zero values are not allowed.');
                return;
            }

            if ((address.country || 'United Arab Emirates') === 'India') {
                if (!/^[1-9][0-9]{5}$/.test(normalizedZip)) {
                    toast.error('Please enter a valid 6-digit Indian pincode.');
                    return;
                }
            }
            
            const token = await getToken()
            
            // Prepare address data with userId from authenticated user
            const addressData = { ...address, userId: user.uid, phone: cleanedPhone };
            addressData.zip = normalizedZip;
            addressData.alternatePhone = cleanedAlternate || '';
            addressData.alternatePhoneCode = cleanedAlternate ? address.alternatePhoneCode || address.phoneCode : '';
            
            if (!addressData.zip || addressData.zip.trim() === '') {
                delete addressData.zip
            }
            // Remove district if not present or empty (to match Prisma schema)
            if (!addressData.district) {
                delete addressData.district;
            }
            if (!addressData.alternatePhone) {
                delete addressData.alternatePhone;
                delete addressData.alternatePhoneCode;
            }
            
            console.log('AddressModal - Sending address:', addressData);
            
            if (isEdit && addressData.id) {
                const { data } = await axios.put('/api/address', { id: addressData.id, address: addressData }, { headers: { Authorization: `Bearer ${token}` } })
                toast.success(data.message || 'Address updated')
                if (onAddressUpdated) {
                    onAddressUpdated(data.updated)
                }
            } else {
                const { data } = await axios.post('/api/address', {address: addressData}, {headers: { Authorization: `Bearer ${token}` } })
                dispatch(addAddress(data.newAddress))
                // Immediately refresh address list in Redux after adding
                dispatch(fetchAddress({ getToken }))
                toast.success(data.message)
                if (onAddressAdded) {
                    onAddressAdded(data.newAddress);
                }
            }
            setShowAddressModal(false)
            // Reset form state after save
            setAddress({
                name: '',
                email: '',
                street: '',
                city: '',
                state: '',
                district: '',
                zip: '',
                country: 'United Arab Emirates',
                phone: '',
                phoneCode: '+971',
                alternatePhone: '',
                alternatePhoneCode: '+971',
                id: null,
            })
        } catch (error) {
            console.log(error)
            toast.error(error?.response?.data?.error || error?.response?.data?.message || error.message)
        }
    }

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-md">
            <div className="my-8 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/60 bg-[linear-gradient(180deg,#ffffff_0%,#fff8ef_100%)] shadow-[0_28px_90px_rgba(15,23,42,0.28)]">
                {/* Header */}
                <div className="relative overflow-hidden border-b border-[#f1dfc8] bg-[radial-gradient(circle_at_top_left,#fff4d6,transparent_42%),linear-gradient(135deg,#ffffff_0%,#fff8ef_72%,#fff2df_100%)] px-6 py-6">
                    <div className="absolute -right-10 top-0 h-28 w-28 rounded-full bg-[#ffedd1] blur-2xl" />
                    <div className="absolute bottom-0 left-16 h-16 w-40 rounded-full bg-[#ffe8c1]/70 blur-2xl" />
                    <div className="relative flex items-start justify-between gap-4">
                        <div>
                            <span className="inline-flex items-center rounded-full border border-[#f3d7aa] bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a16207] shadow-sm">
                                Delivery Details
                            </span>
                            <h2 className="mt-3 text-[28px] font-black tracking-[-0.03em] text-slate-900">
                                {mode === 'select' ? 'Choose Delivery Address' : (isEdit || editingAddress ? 'Update Address' : 'Add New Address')}
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                {mode === 'select'
                                    ? 'Select where this order should arrive, or add a new address.'
                                    : 'Fill in the address details carefully so delivery and contact updates reach the right place.'}
                            </p>
                        </div>
                        <button type="button" onClick={() => setShowAddressModal(false)} className="grid h-11 w-11 place-items-center rounded-full border border-[#ead7bd] bg-white/90 text-slate-500 transition hover:bg-white hover:text-slate-700 hover:shadow-sm">
                        <XIcon size={24} />
                    </button>
                    </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {mode === 'select' ? (
                        /* Address Selection List */
                        <div className="p-6 md:p-7">
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Saved Addresses</h3>
                                    <p className="mt-1 text-sm text-slate-600">Tap any card to use it instantly at checkout.</p>
                                </div>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                                    {addressList.length} saved
                                </span>
                            </div>
                            <div className="space-y-4">
                                {addressList.map((addr) => {
                                    const isSelected = selectedAddressId === addr._id;
                                    return (
                                        <div
                                            key={addr._id}
                                            className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 ${
                                                isSelected 
                                                    ? 'border-[#f59e0b] bg-[linear-gradient(135deg,#fff8e7_0%,#ffffff_100%)] shadow-[0_18px_40px_rgba(245,158,11,0.16)]' 
                                                    : 'border-[#ebe5dc] bg-white/90 hover:-translate-y-0.5 hover:border-[#f3c98b] hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)]'
                                            }`}
                                            onClick={() => {
                                                if (onSelectAddress) {
                                                    onSelectAddress(addr._id);
                                                }
                                                setShowAddressModal(false);
                                            }}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex flex-1 items-start gap-4">
                                                    {/* Radio/Checkmark */}
                                                    <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                                                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                                    }`}>
                                                        {isSelected && (
                                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Address Details */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                                            <div className="font-bold text-slate-900">{addr.name}</div>
                                                            {isSelected && (
                                                                <span className="rounded-full bg-[#fff1c7] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#a16207]">
                                                                    Selected
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-sm font-medium text-slate-700">{addr.street}</div>
                                                        <div className="mt-1 text-sm text-slate-600">
                                                            {addr.city}, {addr.district && `${addr.district}, `}{addr.state}
                                                        </div>
                                                        <div className="text-sm text-slate-600">
                                                            {addr.country} - {addr.zip || addr.pincode || 'N/A'}
                                                        </div>
                                                        <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-[#c2410c]">
                                                            {addr.phoneCode || '+971'} {addr.phone}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Action Menu */}
                                                <div className="ml-2 flex gap-2">
                                                    <button
                                                        type="button"
                                                        className="rounded-full border border-[#dbe7ff] bg-[#f5f9ff] px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-[#ebf3ff]"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            console.log('✏️ Edit clicked for address:', addr.name, addr);
                                                            setEditingAddress(addr);
                                                            setMode('form');
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            {/* Add New Address Button */}
                            <button
                                type="button"
                                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#f2bf73] bg-[linear-gradient(180deg,#fffdf8_0%,#fff6e9_100%)] p-4 font-semibold text-[#b45309] transition hover:border-[#e7a84b] hover:bg-[#fff5df]"
                                onClick={() => {
                                    console.log('➕ Add New Address clicked');
                                    setEditingAddress(null);
                                    setMode('form');
                                }}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add New Address
                            </button>
                        </div>
                    ) : (
                        /* Address Form */
                        <form onSubmit={e => toast.promise(handleSubmit(e), { loading: 'Adding Address...' })} className="p-6 md:p-7">
                    <div className="grid gap-5">
                    <div className="grid gap-5 rounded-[24px] border border-[#f1e4d3] bg-white/88 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] md:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Contact information</h3>
                                <p className="mt-1 text-sm text-slate-500">Who should receive delivery and order updates?</p>
                            </div>
                            <span className="rounded-full bg-[#fff5db] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#b45309]">
                                Step 1
                            </span>
                        </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full Name</label>
                        <input 
                            name="name" 
                            onChange={handleAddressChange} 
                            value={address.name} 
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]" 
                            type="text" 
                            placeholder="Enter your name" 
                            required 
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email Address</label>
                        <input 
                            name="email" 
                            onChange={handleAddressChange} 
                            value={address.email} 
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]" 
                            type="email" 
                            placeholder="Email address" 
                        />
                    </div>
                    </div>

                    <div className="grid gap-5 rounded-[24px] border border-[#f1e4d3] bg-white/88 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] md:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Address details</h3>
                                <p className="mt-1 text-sm text-slate-500">Make sure this matches the exact drop-off location.</p>
                            </div>
                            <span className="rounded-full bg-[#fff5db] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#b45309]">
                                Step 2
                            </span>
                        </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Street name, building number, apartment number</label>
                        <input 
                            name="street" 
                            onChange={handleAddressChange} 
                            value={address.street} 
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]" 
                            type="text" 
                            placeholder="Street name, building number, apartment number" 
                            required 
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">City</label>
                            <input 
                                name="city" 
                                onChange={handleAddressChange} 
                                value={address.city} 
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]" 
                                type="text" 
                                placeholder="City" 
                                required 
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Area/District</label>
                            <input 
                                name="district" 
                                onChange={handleAddressChange} 
                                value={address.district} 
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]" 
                                type="text" 
                                placeholder="Area or district" 
                                required 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{address.country === 'United Arab Emirates' ? 'Emirate' : 'State'}</label>
                            {(address.country === 'India' || address.country === 'United Arab Emirates') ? (
                                <select
                                    name="state"
                                    onChange={handleAddressChange}
                                    value={address.state}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]"
                                    required
                                >
                                    <option value="">{address.country === 'United Arab Emirates' ? 'Select Emirate' : 'Select State'}</option>
                                    {(address.country === 'United Arab Emirates' ? uaeEmirates : indianStates).map((state) => (
                                        <option key={state} value={state}>{state}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    name="state"
                                    onChange={handleAddressChange}
                                    value={address.state}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]"
                                    type="text"
                                    placeholder="State/Region"
                                    required
                                />
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Country</label>
                        <select 
                            name="country" 
                            onChange={handleAddressChange} 
                            value={address.country} 
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]" 
                            required
                        >
                            {countries.map((country) => (
                                <option key={country.name} value={country.name}>
                                    {country.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    </div>

                    <div className="grid gap-5 rounded-[24px] border border-[#f1e4d3] bg-white/88 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] md:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Phone numbers</h3>
                                <p className="mt-1 text-sm text-slate-500">We may call this number if the rider needs help finding you.</p>
                            </div>
                            <span className="rounded-full bg-[#fff5db] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#b45309]">
                                Step 3
                            </span>
                        </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Phone Number</label>
                        <div className="flex gap-2">
                            <select
                                name="phoneCode"
                                onChange={handleAddressChange}
                                value={address.phoneCode}
                                className="min-w-[88px] rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 font-medium text-slate-700 outline-none transition focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]"
                                required
                            >
                                {countries.map((country) => (
                                    <option key={country.code} value={country.code}>{country.code}</option>
                                ))}
                            </select>
                            <input 
                                key={address.id || 'new'}
                                ref={phoneInputRef}
                                name="phone" 
                                onChange={(e) => {
                                    // Only allow numbers, max 15 digits
                                    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 15);
                                    e.target.value = value;
                                    setAddress({
                                        ...address,
                                        phone: value
                                    });
                                }}
                                defaultValue={address.phone}
                                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]" 
                                type="text"
                                inputMode="numeric"
                                placeholder={address.phoneCode === '+971' ? '501234567' : '9876543210'} 
                                maxLength="15"
                                pattern="[0-9]{7,15}"
                                title="Phone number must be 7-15 digits"
                                required 
                                autoComplete="off"
                            />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Enter phone number without country code</p>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Alternate Phone (Optional)</label>
                        <div className="flex gap-2">
                            <select
                                name="alternatePhoneCode"
                                onChange={handleAddressChange}
                                value={address.alternatePhoneCode}
                                className="min-w-[88px] rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 font-medium text-slate-700 outline-none transition focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]"
                            >
                                {countries.map((country) => (
                                    <option key={country.code} value={country.code}>{country.code}</option>
                                ))}
                            </select>
                            <input
                                name="alternatePhone"
                                onChange={(e) => {
                                    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 15);
                                    e.target.value = value;
                                    setAddress({
                                        ...address,
                                        alternatePhone: value
                                    });
                                }}
                                value={address.alternatePhone}
                                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]"
                                type="text"
                                inputMode="numeric"
                                placeholder="Alternate contact number"
                                maxLength="15"
                                pattern="[0-9]{7,15}"
                                title="Phone number must be 7-15 digits"
                                autoComplete="off"
                            />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Optional number we can reach if primary is unavailable.</p>
                    </div>
                    </div>

                    <div className="mt-2 flex gap-3">
                        <button 
                            type="submit"
                            className="flex-1 rounded-2xl bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_100%)] py-3.5 font-semibold text-white shadow-[0_16px_34px_rgba(37,99,235,0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(37,99,235,0.36)]"
                        >
                            {isEdit ? 'SAVE CHANGES' : 'SAVE ADDRESS'}
                        </button>
                        <button 
                            type="button"
                            onClick={() => {
                                if (mode === 'form' && addressList.length > 0 && !isEdit) {
                                    setMode('select'); // Go back to selection
                                } else {
                                    setShowAddressModal(false);
                                }
                            }}
                            className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-200"
                        >
                            {mode === 'form' && addressList.length > 0 && !isEdit ? 'BACK' : 'CANCEL'}
                        </button>
                    </div>
                    </div>
                </form>
                    )}
                </div>
            </div>
        </div>
    )
}

export default AddressModal