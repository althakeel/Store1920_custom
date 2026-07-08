'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/useAuth'
import Loading from '@/components/Loading'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Send, CheckCircle, MessageSquare, Clock, XCircle } from 'lucide-react'

export default function AdminTicketDetailPage() {
  const { ticketId } = useParams()
  const router = useRouter()
  const { user, loading, getToken } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [loadingTicket, setLoadingTicket] = useState(true)
  const [replyMessage, setReplyMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (user && ticketId) {
      fetchTicket()
    } else if (!loading) {
      setLoadingTicket(false)
    }
  }, [user, ticketId, loading])

  const fetchTicket = async () => {
    try {
      setLoadingTicket(true)
      const token = await getToken(true)
      const { data } = await axios.get(`/api/store/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setTicket(data.ticket)
    } catch (error) {
      console.error('Failed to fetch ticket:', error)
      toast.error('Failed to load ticket')
      router.push('/store/tickets')
    } finally {
      setLoadingTicket(false)
    }
  }

  const handleReplySubmit = async (e) => {
    e.preventDefault()
    if (!replyMessage.trim()) return

    try {
      setSubmitting(true)
      const token = await getToken(true)
      const { data } = await axios.post(
        `/api/store/tickets/${ticketId}/reply`,
        { message: replyMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setTicket(data.ticket)
      setReplyMessage('')
      toast.success('Reply sent successfully')
    } catch (error) {
      console.error('Failed to send reply:', error)
      toast.error(error?.response?.data?.error || 'Failed to send reply')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (newStatus) => {
    if (!confirm(`Are you sure you want to change status to "${newStatus}"?`)) return

    try {
      setUpdatingStatus(true)
      const token = await getToken(true)
      const { data } = await axios.patch(
        `/api/store/tickets/${ticketId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setTicket(data.ticket)
      toast.success('Status updated successfully')
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error(error?.response?.data?.error || 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading || loadingTicket) return <Loading />

  if (!ticket) {
    return (
      <div className="max-w-4xl mx-auto text-center py-10">
        <p className="text-slate-600">Ticket not found</p>
        <Link href="/store/tickets" className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
          Back to Tickets
        </Link>
      </div>
    )
  }

  const getStatusBadge = (status) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800',
      'in-progress': 'bg-orange-100 text-orange-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    }
    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${colors[status] || colors.open}`}>
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
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${colors[priority] || colors.normal}`}>
        {String(priority || 'normal').toUpperCase()}
      </span>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <Link
          href="/store/tickets"
          className="inline-flex items-center gap-2 text-blue-600 hover:underline mb-4"
        >
          <ArrowLeft size={16} />
          Back to Tickets
        </Link>
        
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-slate-800 mb-2">{ticket.subject}</h1>
            <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
              <span>Customer: <strong>{ticket.userName}</strong> ({ticket.userEmail})</span>
              <span className="font-medium text-blue-600">{ticket.category}</span>
              {ticket.orderId && (
                <span className="font-bold text-purple-700 bg-purple-100 px-3 py-1 rounded-lg flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  Order #{ticket.orderId.orderNumber || ticket.orderId._id?.slice(-8) || 'N/A'}
                </span>
              )}
              <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {getPriorityBadge(ticket.priority)}
            {getStatusBadge(ticket.status)}
          </div>
        </div>
      </div>

      {/* Status Actions */}
      {ticket.status !== 'closed' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm font-medium text-slate-700">Update Status:</span>
            <div className="flex gap-2 flex-wrap">
              {ticket.status === 'open' && (
                <button
                  onClick={() => handleStatusChange('in-progress')}
                  disabled={updatingStatus}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition"
                >
                  <Clock size={16} />
                  Mark In Progress
                </button>
              )}
              {(ticket.status === 'open' || ticket.status === 'in-progress') && (
                <>
                  <button
                    onClick={() => handleStatusChange('resolved')}
                    disabled={updatingStatus}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    <CheckCircle size={16} />
                    Mark Resolved
                  </button>
                  <button
                    onClick={() => handleStatusChange('closed')}
                    disabled={updatingStatus}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition"
                  >
                    <XCircle size={16} />
                    Close Ticket
                  </button>
                </>
              )}
              {ticket.status === 'resolved' && (
                <button
                  onClick={() => handleStatusChange('closed')}
                  disabled={updatingStatus}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition"
                >
                  <XCircle size={16} />
                  Close Ticket
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Original Message */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold flex-shrink-0">
            {ticket.userName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-slate-900">{ticket.userName}</span>
              <span className="text-xs text-slate-500">
                {new Date(ticket.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
          </div>
        </div>
      </div>

      {/* Replies */}
      {ticket.replies && ticket.replies.length > 0 && (
        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare size={20} />
            Conversation ({ticket.replies.length})
          </h2>
          {ticket.replies.map((reply, index) => (
            <div
              key={index}
              className={`border rounded-xl shadow-sm p-6 ${
                reply.sender === 'admin' 
                  ? 'bg-orange-50 border-orange-200' 
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 ${
                    reply.sender === 'admin' ? 'bg-orange-600' : 'bg-blue-600'
                  }`}
                >
                  {reply.sender === 'admin' ? 'A' : (reply.senderName?.[0]?.toUpperCase() || 'U')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-semibold text-slate-900">
                      {reply.sender === 'admin' ? 'Support Team (You)' : reply.senderName}
                    </span>
                    {reply.sender === 'admin' && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-800 rounded-full">
                        ADMIN
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {new Date(reply.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap">{reply.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply Form */}
      {ticket.status !== 'closed' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Reply to Customer</h3>
          <form onSubmit={handleReplySubmit} className="space-y-4">
            <textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Type your response here..."
              rows={6}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
              required
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !replyMessage.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Send size={16} />
                {submitting ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </form>
        </div>
      )}

      {ticket.status === 'closed' && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl shadow-sm p-6 text-center">
          <XCircle className="mx-auto mb-3 text-gray-600" size={48} />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">This ticket is closed</h3>
          <p className="text-gray-600">
            Closed on {new Date(ticket.closedAt || ticket.updatedAt).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  )
}
