'use client'
import Loading from "@/components/Loading"


import axios from "axios"
import { UserPlusIcon, UploadCloudIcon, FolderTreeIcon } from "lucide-react"
import ContactMessagesSeller from "./ContactMessagesSeller.jsx";
import dynamic from "next/dynamic";
import Link from "next/link"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useAuth } from '@/lib/useAuth'

const StoreDashboardCharts = dynamic(() => import("@/components/store/StoreDashboardCharts"), { ssr: false });

export default function Dashboard() {
    const { user, loading: authLoading, getToken } = useAuth();
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED'
    const [loading, setLoading] = useState(true)
    const [dashboardData, setDashboardData] = useState({
        totalProducts: 0,
        totalEarnings: 0,
        totalOrders: 0,
        totalCustomers: 0,
        abandonedCarts: 0,
        ratings: [],
        analytics: {
            ordersTrend: [],
            ordersStatusTrend: [],
            statusTotals: {
                total: 0,
                processing: 0,
                shipping: 0,
                delivered: 0,
                returned: 0,
                cancelled: 0,
            },
            orderStatusBreakdown: [],
            ratingBreakdown: [],
            avgOrderValue: 0,
            avgRating: 0,
            ordersThisWeek: 0,
            revenueThisWeek: 0,
        },
    })
    
    // Invitation states
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteLoading, setInviteLoading] = useState(false)
    const [teamUsers, setTeamUsers] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(true)

    const withTokenRetry = async (requestFn) => {
        try {
            return await requestFn(false);
        } catch (error) {
            if (error?.response?.status === 401) {
                return requestFn(true);
            }
            throw error;
        }
    }

    // Fetch team users
    const fetchTeamUsers = async () => {
        try {
            const { data } = await withTokenRetry(async (forceRefresh) => {
                const token = await getToken(forceRefresh);
                return axios.get('/api/store/users', {
                    headers: { Authorization: `Bearer ${token}` }
                });
            });
            const allUsers = [...(data.users || []), ...(data.pending || [])];
            setTeamUsers(allUsers);
        } catch (error) {
            console.error('Failed to fetch team users:', error);
        } finally {
            setLoadingUsers(false);
        }
    };

    useEffect(() => {
        const fetchDashboard = async () => {
            if (!user) {
                setLoading(false);
                setLoadingUsers(false);
                return;
            }

            try {
                const { data } = await withTokenRetry(async (forceRefresh) => {
                    const token = await getToken(forceRefresh);
                    return axios.get('/api/store/dashboard', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                });
                setDashboardData(data.dashboardData);
                
                // Fetch team users
                await fetchTeamUsers();
            } catch (error) {
                console.error('Dashboard fetch error:', error);
                toast.error(error?.response?.data?.error || 'Failed to load dashboard');
            } finally {
                setLoading(false);
            }
        };

        if (!authLoading) {
            fetchDashboard();
        }
    }, [authLoading, user]);

    const handleInviteUser = async (e) => {
        e.preventDefault();
        
        if (teamUsers.length >= 5) {
            toast.error('Maximum 5 team members allowed');
            return;
        }
        
        setInviteLoading(true);
        try {
            const { data } = await withTokenRetry(async (forceRefresh) => {
                const token = await getToken(forceRefresh);
                return axios.post('/api/store/users/invite', 
                    { email: inviteEmail }, 
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            });
            
            toast.success(data.message || 'Invitation sent successfully!');
            setInviteEmail('');
            await fetchTeamUsers(); // Refresh the list
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to send invitation');
        } finally {
            setInviteLoading(false);
        }
    };

    if (authLoading || loading) return <Loading />

    if (!user) {
        return (
            <div className="min-h-[80vh] mx-6 flex items-center justify-center text-slate-400">
                <h1 className="text-2xl sm:text-4xl font-semibold">Please <span className="text-slate-500">Login</span> to view your dashboard</h1>
            </div>
        );
    }

    return (
        <div className="mb-16 w-full max-w-none text-slate-500">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-lg font-medium text-slate-800 sm:text-xl">Seller Dashboard</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href="/store/categories"
                        className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm text-white transition hover:bg-amber-700"
                    >
                        <FolderTreeIcon size={15} />
                        <span>Import Categories</span>
                    </Link>
                    <Link
                        href="/store/bulk-import"
                        className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white transition hover:bg-emerald-700"
                    >
                        <UploadCloudIcon size={15} />
                        <span>Bulk Import</span>
                    </Link>
                    <Link 
                        href="/store/settings/users" 
                        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white transition hover:bg-blue-700"
                    >
                        <UserPlusIcon size={15} />
                        <span>Invite Team Members</span>
                    </Link>
                </div>
            </div>

            <StoreDashboardCharts data={dashboardData} currency={currency} />

            <ContactMessagesSeller />
        </div>
    )
}