
'use client'
import PageTitle from "@/components/PageTitle"
import { useCallback, useEffect, useState } from "react";
import OrderItem from "@/components/OrderItem";
import axios from "axios";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import Loading from "@/components/Loading";
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { GUEST_ORDERS_LINKED_EVENT, linkGuestOrdersForCurrentUser } from '@/lib/linkGuestOrdersClient';

export default function OrdersClient() {
    const [user, setUser] = useState(undefined);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true)

    const router = useRouter()

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null));
        return () => unsub();
    }, []);

    const fetchOrders = useCallback(async () => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) return;

            const token = await currentUser.getIdToken(true);
            await linkGuestOrdersForCurrentUser(currentUser, token);

            const { data } = await axios.get('/api/orders', { headers: { Authorization: `Bearer ${token}` } });
            let list = Array.isArray(data?.orders) ? data.orders : (Array.isArray(data) ? data : []);
            
            // Fetch latest Delhivery tracking status for orders with trackingId
            list = await Promise.all(list.map(async (order) => {
                let updatedOrder = { ...order };
                
                if (order.trackingId) {
                    try {
                        const trackingResponse = await axios.get(`/api/track-order?awb=${order.trackingId}`, { 
                            headers: { Authorization: `Bearer ${token}` } 
                        });
                        if (trackingResponse.data.success && trackingResponse.data.order) {
                            updatedOrder = {
                                ...updatedOrder,
                                delhivery: trackingResponse.data.order.delhivery,
                                status: trackingResponse.data.order.status || updatedOrder.status,
                                trackingUrl: trackingResponse.data.order.trackingUrl || updatedOrder.trackingUrl
                            };
                        }
                    } catch (error) {
                        console.error(`Failed to fetch tracking for ${order.trackingId}:`, error);
                    }
                }
                
                // Auto-mark COD orders as PAID if they're DELIVERED
                const paymentMethod = (updatedOrder.paymentMethod || '').toLowerCase();
                const status = (updatedOrder.status || '').toUpperCase();
                
                if (paymentMethod === 'cod' && status === 'DELIVERED') {
                    updatedOrder.isPaid = true;
                }
                
                // Also check if Delhivery reported payment collected
                if (updatedOrder.delhivery?.payment?.is_cod_recovered && paymentMethod === 'cod') {
                    updatedOrder.isPaid = true;
                }
                
                return updatedOrder;
            }));
            
            setOrders(list);
            setLoading(false);
        } catch (error) {
            console.error('[ORDERS] Fetch error:', error?.response?.data || error.message);
            toast.error(error?.response?.data?.error || 'Failed to load orders');
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user === undefined) return;
        if (user) {
            fetchOrders();
        } else {
            setLoading(false);
        }
    }, [user, fetchOrders]);

    useEffect(() => {
        const handleGuestOrdersLinked = () => {
            if (auth.currentUser) {
                setLoading(true);
                fetchOrders();
            }
        };

        window.addEventListener(GUEST_ORDERS_LINKED_EVENT, handleGuestOrdersLinked);
        return () => window.removeEventListener(GUEST_ORDERS_LINKED_EVENT, handleGuestOrdersLinked);
    }, [fetchOrders]);

    if(user === undefined || loading){
        return <Loading />
    }

    if(user === null){
        return (
            <div className="min-h-[70vh] flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-semibold text-slate-800 mb-4">Please Sign In</h1>
                    <p className="text-slate-600 mb-6">You need to sign in to view your orders.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                    >
                        Go to Home
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-[70vh] mx-6">
            <div className="flex justify-end my-4">
                <button
                    className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                    onClick={() => router.push('/admin/profile')}
                >
                    Edit Profile
                </button>
            </div>
            {orders.length > 0 ? (
                <div className="my-20 max-w-7xl mx-auto">
                    <PageTitle heading="My Orders" text={`Showing total ${orders.length} orders`} linkText={'Go to home'} />

                    {/* Card-based layout instead of table */}
                    <div className="mt-8 space-y-6">
                        {orders.map((order) => (
                            <OrderItem order={order} key={order._id || order.id} currencySymbol="AED" />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="min-h-[80vh] mx-6 flex items-center justify-center text-slate-400">
                    <h1 className="text-2xl sm:text-4xl font-semibold">You have no orders</h1>
                </div>
            )}
        </div>
    )
}
