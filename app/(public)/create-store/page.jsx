'use client'
import { assets } from "@/assets/assets"
import { useEffect, useState } from "react"
import Image from "next/image"
import toast from "react-hot-toast"
import Loading from "@/components/Loading"
import { auth } from '@/lib/firebase'
import { useRouter } from "next/navigation"
import axios from "axios"





function CreateStoreAuthed() {
    const [firebaseUser, setFirebaseUser] = useState(null);
    const router = useRouter();
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setFirebaseUser(user);
        });
        return () => unsubscribe();
    }, []);

    const [alreadySubmitted, setAlreadySubmitted] = useState(false)
    const [status, setStatus] = useState("")
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState("")

    const [storeInfo, setStoreInfo] = useState({
        name: "",
        username: "",
        description: "",
        email: "",
        contact: "",
        address: "",
        image: ""
    })

    const onChangeHandler = (e) => {
        setStoreInfo({ ...storeInfo, [e.target.name]: e.target.value })
    }

    const getAuthHeaders = async (forceRefresh = false) => {
        if (!firebaseUser) throw new Error('Please login to continue');
        const token = await firebaseUser.getIdToken(forceRefresh);
        return { Authorization: `Bearer ${token}` };
    }

    const isTokenError = (error) => {
        const status = error?.response?.status;
        const message = String(error?.response?.data?.error || error?.message || '').toLowerCase();
        return status === 401 && message.includes('token');
    }

    const withTokenRetry = async (requestFn) => {
        try {
            return await requestFn(false);
        } catch (error) {
            if (firebaseUser && isTokenError(error)) {
                return requestFn(true);
            }
            throw error;
        }
    }

    const fetchSellerStatus = async () => {
        if (!firebaseUser) return;
        try {
            const { data } = await withTokenRetry(async (forceRefresh) => {
                const headers = await getAuthHeaders(forceRefresh);
                return axios.get('/api/store/create', { headers });
            })
            if ([ 'approved', 'rejected', 'pending' ].includes(data.status)) {
                setStatus(data.status)
                setAlreadySubmitted(true)
                switch (data.status) {
                    case "approved":
                        setMessage("Your store has been approved, you can now add products to your store from dashboard")
                        setTimeout(() => router.push("/store"), 5000)
                        break
                    case "rejected":
                        setMessage("Your store request has been rejected, contact the admin for more details")
                        break
                    case "pending":
                        setMessage("Your store request is pending, please wait for admin to approve your store")
                        break
                    default:
                        break
                }
            } else {
                setAlreadySubmitted(false)
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
        setLoading(false)
    }

    const onSubmitHandler = async (e) => {
        e.preventDefault();
        if (!firebaseUser) {
            return toast('Please login to continue');
        }
        try {
            const formData = new FormData();
            formData.append("name", storeInfo.name);
            formData.append("description", storeInfo.description);
            formData.append("username", storeInfo.username);
            formData.append("email", storeInfo.email);
            formData.append("contact", storeInfo.contact);
            formData.append("address", storeInfo.address);
            formData.append("image", storeInfo.image);

            const { data } = await withTokenRetry(async (forceRefresh) => {
                const headers = await getAuthHeaders(forceRefresh);
                return axios.post('/api/store/create', formData, { headers });
            });
            toast.success(data.message);
            await fetchSellerStatus();
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message);
        }
    }

    useEffect(() => {
        if (firebaseUser) {
            fetchSellerStatus();
        }
    }, [firebaseUser]);

    if (!firebaseUser) {
        return (
            <div className="min-h-[80vh] mx-6 flex items-center justify-center text-slate-400">
                <h1 className="text-2xl sm:text-4xl font-semibold">Please <span className="text-slate-500">Login</span> to continue</h1>
            </div>
        );
    }

    return !loading ? (
        <>
            {!alreadySubmitted ? (
                <div className="mx-6 min-h-[70vh] my-16">
                    <form onSubmit={e => toast.promise(onSubmitHandler(e), { loading: "Submitting data..." })} className="max-w-7xl mx-auto flex flex-col items-start gap-3 text-slate-500">
                        {/* Title */}
                        <div>
                            <h1 className="text-3xl ">Add Your <span className="text-slate-800 font-medium">Store</span></h1>
                            <p className="max-w-lg">To become a seller on Qui, submit your store details for review. Your store will be activated after admin verification.</p>
                        </div>

                        <label className="mt-10 cursor-pointer">
                            Store Logo
                            <Image src={storeInfo.image ? URL.createObjectURL(storeInfo.image) : assets.upload_area} className="rounded-lg mt-2 h-16 w-auto" alt="" width={150} height={100} />
                            <input type="file" accept="image/*" onChange={(e) => setStoreInfo({ ...storeInfo, image: e.target.files[0] })} hidden />
                        </label>

                        <p>Username</p>
                        <input name="username" onChange={onChangeHandler} value={storeInfo.username} type="text" placeholder="Enter your store username" className="border border-slate-300 outline-slate-400 w-full max-w-lg p-2 rounded" />

                        <p>Name</p>
                        <input name="name" onChange={onChangeHandler} value={storeInfo.name} type="text" placeholder="Enter your store name" className="border border-slate-300 outline-slate-400 w-full max-w-lg p-2 rounded" />

                        <p>Description</p>
                        <textarea name="description" onChange={onChangeHandler} value={storeInfo.description} rows={5} placeholder="Enter your store description" className="border border-slate-300 outline-slate-400 w-full max-w-lg p-2 rounded resize-none" />


                                                <p>Email</p>
                                                <div className="relative w-full max-w-lg">
                                                    <input name="email" onChange={onChangeHandler} value={storeInfo.email} type="email" placeholder="Enter your store email" className="border border-slate-300 outline-slate-400 w-full p-2 rounded pr-24" />
                                                    {storeInfo.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(storeInfo.email) && (
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-green-50 px-2 py-1 rounded text-green-700 text-xs border border-green-200">
                                                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#22c55e"/><path d="M7 13l3 3 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                            Valid email
                                                        </span>
                                                    )}
                                                </div>

                                                <p>Contact Number</p>
                                                <div className="relative w-full max-w-lg">
                                                    <input name="contact" onChange={onChangeHandler} value={storeInfo.contact} type="text" placeholder="Enter your store contact number" className="border border-slate-300 outline-slate-400 w-full p-2 rounded pr-24" />
                                                    {storeInfo.contact && /^\d{10,}$/.test(storeInfo.contact) && (
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-green-50 px-2 py-1 rounded text-green-700 text-xs border border-green-200">
                                                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#22c55e"/><path d="M7 13l3 3 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                            Valid number
                                                        </span>
                                                    )}
                                                </div>

                                                <p>Address</p>
                                                <textarea name="address" onChange={onChangeHandler} value={storeInfo.address} rows={5} placeholder="Enter your store address" className="border border-slate-300 outline-slate-400 w-full max-w-lg p-2 rounded resize-none" />

                        <button className="bg-slate-800 text-white px-12 py-2 rounded mt-10 mb-40 active:scale-95 hover:bg-slate-900 transition ">Submit</button>
                    </form>
                </div>
            ) : (
                <div className="min-h-[80vh] flex flex-col items-center justify-center">
                    <p className="sm:text-2xl lg:text-3xl mx-5 font-semibold text-slate-500 text-center max-w-2xl">{message}</p>
                    {status === "approved" && <p className="mt-5 text-slate-400">redirecting to dashboard in <span className="font-semibold">5 seconds</span></p>}
                </div>
            )}
        </>
    ) : (<Loading />)
}

export default function CreateStore() {
    return <CreateStoreAuthed />;
}