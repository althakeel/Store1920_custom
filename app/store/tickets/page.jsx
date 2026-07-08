'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/useAuth'
import Loading from '@/components/Loading'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import { MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, Users, Filter } from 'lucide-react'

export default function AdminTicketsPage() {
  const { user, loading, getToken } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [filter, setFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 })

  useEffect(() => {
    if (user) {
      fetchTickets()
    } else if (!loading) {
      setLoadingTickets(false)
    }
  }, [user, loading])

  const fetchTickets = async () => {
    try {
      setLoadingTickets(true)
      const token = await getToken(true)
      const { data } = await axios.get('/api/store/tickets', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setTickets(data.tickets || [])
      
      const ticketList = data.tickets || []
      const stats = {
        total: ticketList.length,
        open: ticketList.filter(t => t.status === 'open').length,
        inProgress: ticketList.filter(t => t.status === 'in-progress').length,
        resolved: ticketList.filter(t => t.status === 'resolved').length,
        closed: ticketList.filter(t => t.status === 'closed').length,
      }
      setStats(stats)
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
      toast.error('Failed to load tickets')
    } finally {
      setLoadingTickets(false)
    }
  }

  if (loading || loadingTickets) return <Loading />

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="text-blue-600" size={20} />
      case 'in-progress':
        return <Clock className="text-orange-600" size={20} />
      case 'resolved':
        return <CheckCircle className="text-green-600" size={20} />
      case 'closed':
        return <XCircle className="text-gray-600" size={20} />
      default:
        return <MessageSquare className="text-gray-600" size={20} />
    }
  }

  const getStatusBadge = (status) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800',
      'in-progress': 'bg-orange-100 text-orange-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[status] || colors.open}`}>
        {status.replace('-', ' ').toUpperCase()}
      </span>
    )
  }

  const getPriorityBadge = (priority) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      normal: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[priority] || colors.normal}`}>
        {String(priority || 'normal').toUpperCase()}
      </span>
    )
  }

  const filteredTickets = tickets.filter(ticket => {
    const statusMatch = filter === 'all' ? true :
      filter === 'open' ? (ticket.status === 'open' || ticket.status === 'in-progress') :
      filter === 'closed' ? (ticket.status === 'closed' || ticket.status === 'resolved') :
      ticket.status === filter

    const priorityMatch = priorityFilter === 'all' ? true : ticket.priority === priorityFilter

    return statusMatch && priorityMatch
  })

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Support Tickets</h1>
          <p className="text-sm text-slate-600 mt-1">Manage customer support requests</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
          <div className="text-sm text-slate-600">Total Tickets</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-800">{stats.open}</div>
          <div className="text-sm text-blue-600">Open</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-800">{stats.inProgress}</div>
          <div className="text-sm text-orange-600">In Progress</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-800">{stats.resolved}</div>
          <div className="text-sm text-green-600">Resolved</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-800">{stats.closed}</div>
          <div className="text-sm text-gray-600">Closed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Status:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
          <button
            onClick={() => { setFilter('all'); setPriorityFilter('all'); }}
            className="ml-auto text-sm text-blue-600 hover:underline"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-12 text-center">
          <MessageSquare className="mx-auto mb-4 text-gray-400" size={48} />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Tickets Found</h2>
          <p className="text-gray-600">
            {tickets.length === 0 ? "No support tickets have been created yet." : "No tickets match the current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => (
            <Link
              key={ticket._id}
              href={`/store/tickets/${ticket._id}`}
              className="block bg-white border border-slate-200 rounded-lg shadow-sm p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="mt-1">
                    {getStatusIcon(ticket.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 truncate">{ticket.subject}</h3>
                      {getPriorityBadge(ticket.priority)}
                      {getStatusBadge(ticket.status)}
                    </div>
                    <p className="text-sm text-slate-600 mb-2 line-clamp-2">{ticket.description}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {ticket.userName} ({ticket.userEmail})
                      </span>
                      <span className="font-medium text-blue-600">{ticket.category}</span>
                      {ticket.orderId && (
                        <span className="font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                          Order #{ticket.orderId.orderNumber || ticket.orderId._id?.slice(-8) || 'N/A'}
                        </span>
                      )}
                      <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                      {ticket.replies && ticket.replies.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} />
                          {ticket.replies.length} {ticket.replies.length === 1 ? 'reply' : 'replies'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
