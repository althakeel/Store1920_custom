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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col my-8">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {mode === 'select' ? 'Deliver to' : (isEdit || editingAddress ? 'Edit Address' : 'Add New Address')}
                    </h2>
                    <button type="button" onClick={() => setShowAddressModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                        <XIcon size={24} />
                    </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {mode === 'select' ? (
                        /* Address Selection List */
                        <div className="p-6">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase mb-4">Saved Addresses</h3>
                            <div className="space-y-3">
                                {addressList.map((addr) => {
                                    const isSelected = selectedAddressId === addr._id;
                                    return (
                                        <div
                                            key={addr._id}
                                            className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                                                isSelected 
                                                    ? 'border-blue-500 bg-blue-50' 
                                                    : 'border-gray-200 hover:border-blue-300'
                                            }`}
                                            onClick={() => {
                                                if (onSelectAddress) {
                                                    onSelectAddress(addr._id);
                                                }
                                                setShowAddressModal(false);
                                            }}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3 flex-1">
                                                    {/* Radio/Checkmark */}
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                                                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                                    }`}>
                                                        {isSelected && (
                                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Address Details */}
                                                    <div className="flex-1">
                                                        <div className="font-bold text-gray-900 mb-1">{addr.name}</div>
                                                        <div className="text-gray-700 text-sm">{addr.street}</div>
                                                        <div className="text-gray-600 text-sm">
                                                            {addr.city}, {addr.district && `${addr.district}, `}{addr.state}
                                                        </div>
                                                        <div className="text-gray-600 text-sm">
                                                            {addr.country} - {addr.zip || addr.pincode || 'N/A'}
                                                        </div>
                                                        <div className="text-orange-600 text-sm font-semibold mt-2">
                                                            {addr.phoneCode || '+971'} {addr.phone}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Action Menu */}
                                                <div className="flex gap-2 ml-4">
                                                    <button
                                                        type="button"
                                                        className="text-blue-600 text-xs font-semibold hover:underline"
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
                                className="w-full mt-4 border-2 border-dashed border-blue-400 rounded-lg p-4 text-blue-600 font-semibold hover:bg-blue-50 transition flex items-center justify-center gap-2"
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
                        <form onSubmit={e => toast.promise(handleSubmit(e), { loading: 'Adding Address...' })} className="p-6 space-y-4">
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                        <input 
                            name="name" 
                            onChange={handleAddressChange} 
                            value={address.name} 
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" 
                            type="text" 
                            placeholder="Enter your name" 
                            required 
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                        <input 
                            name="email" 
                            onChange={handleAddressChange} 
                            value={address.email} 
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" 
                            type="email" 
                            placeholder="Email address" 
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Street name, building number, apartment number</label>
                        <input 
                            name="street" 
                            onChange={handleAddressChange} 
                            value={address.street} 
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" 
                            type="text" 
                            placeholder="Street name, building number, apartment number" 
                            required 
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                            <input 
                                name="city" 
                                onChange={handleAddressChange} 
                                value={address.city} 
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" 
                                type="text" 
                                placeholder="City" 
                                required 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Area/District</label>
                            <input 
                                name="district" 
                                onChange={handleAddressChange} 
                                value={address.district} 
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" 
                                type="text" 
                                placeholder="Area or district" 
                                required 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">{address.country === 'United Arab Emirates' ? 'Emirate' : 'State'}</label>
                            {(address.country === 'India' || address.country === 'United Arab Emirates') ? (
                                <select
                                    name="state"
                                    onChange={handleAddressChange}
                                    value={address.state}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white"
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
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                    type="text"
                                    placeholder="State/Region"
                                    required
                                />
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Country</label>
                        <select 
                            name="country" 
                            onChange={handleAddressChange} 
                            value={address.country} 
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white" 
                            required
                        >
                            {countries.map((country) => (
                                <option key={country.name} value={country.name}>
                                    {country.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                        <div className="flex gap-2">
                            <select
                                name="phoneCode"
                                onChange={handleAddressChange}
                                value={address.phoneCode}
                                className="px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium min-w-[80px]"
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
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" 
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
                        <p className="text-xs text-gray-500 mt-1">Enter phone number without country code</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Alternate Phone (Optional)</label>
                        <div className="flex gap-2">
                            <select
                                name="alternatePhoneCode"
                                onChange={handleAddressChange}
                                value={address.alternatePhoneCode}
                                className="px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium min-w-[80px]"
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
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                type="text"
                                inputMode="numeric"
                                placeholder="Alternate contact number"
                                maxLength="15"
                                pattern="[0-9]{7,15}"
                                title="Phone number must be 7-15 digits"
                                autoComplete="off"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Optional number we can reach if primary is unavailable.</p>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button 
                            type="submit"
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg hover:shadow-xl"
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
                            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-3 rounded-lg transition-colors"
                        >
                            {mode === 'form' && addressList.length > 0 && !isEdit ? 'BACK' : 'CANCEL'}
                        </button>
                    </div>
                </form>
                    )}
                </div>
            </div>
        </div>
    )
}

export default AddressModal