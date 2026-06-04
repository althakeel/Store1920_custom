'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react'

const StatusIcon = ({ status, isCompleted, isActive }) => {
  const iconProps = { size: 20, className: 'w-full h-full' }
  
  if (isCompleted) {
    return <CheckCircle {...iconProps} className="text-green-500" />
  }
  if (isActive) {
    return <Clock {...iconProps} className="text-blue-500 animate-spin" />
  }
  return <div className="w-full h-full rounded-full border-2 border-slate-300" />
}

export default function TrackingTimeline({ events, type = 'delhivery' }) {
  const [animatedEvents, setAnimatedEvents] = useState([])

  useEffect(() => {
    // Stagger animation for each event
    events.forEach((event, index) => {
      setTimeout(() => {
        setAnimatedEvents((prev) => [...prev, index])
      }, index * 200)
    })
  }, [events])

  const getStatusColor = (status) => {
    const statusLower = String(status || '').toLowerCase()
    if (statusLower.includes('delivered') || statusLower.includes('pod')) return 'green'
    if (statusLower.includes('out') || statusLower.includes('dispatch')) return 'blue'
    if (statusLower.includes('warehouse') || statusLower.includes('reached')) return 'indigo'
    if (statusLower.includes('picked') || statusLower.includes('pick')) return 'purple'
    if (statusLower.includes('confirm') || statusLower.includes('processing')) return 'yellow'
    if (statusLower.includes('cancel') || statusLower.includes('fail') || statusLower.includes('return')) return 'red'
    return 'slate'
  }

  const colorMap = {
    green: 'bg-green-500 text-white',
    blue: 'bg-blue-500 text-white',
    indigo: 'bg-indigo-500 text-white',
    purple: 'bg-purple-500 text-white',
    yellow: 'bg-yellow-500 text-white',
    red: 'bg-red-500 text-white',
    slate: 'bg-slate-400 text-white',
  }

  const bgColorMap = {
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    indigo: 'bg-indigo-50 border-indigo-200',
    purple: 'bg-purple-50 border-purple-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200',
    slate: 'bg-slate-50 border-slate-200',
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500">No tracking events yet</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Animated vertical line */}
      <div className="absolute left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 via-blue-400 to-slate-200" />

      <div className="space-y-6">
        {events.map((event, idx) => {
          const isAnimated = animatedEvents.includes(idx)
          const color = getStatusColor(event.status)
          const timestamp = type === 'c3xpress' ? event.time : new Date(event.time || event.createdAt).toLocaleString()
          const location = event.location || event.locationName || 'Location not specified'
          const remarks = event.remarks || event.description || ''
          const deliveredTo = event.deliveredTo || ''

          return (
            <div
              key={idx}
              className={`relative pl-16 transition-all duration-500 ${
                isAnimated ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
              }`}
            >
              {/* Status dot */}
              <div
                className={`absolute left-0 top-1.5 w-12 h-12 rounded-full flex items-center justify-center border-4 border-white shadow-lg transition-all duration-300 ${colorMap[color]}`}
              >
                {idx === 0 ? (
                  <TrendingUp size={20} />
                ) : (
                  <CheckCircle size={20} />
                )}
              </div>

              {/* Event card */}
              <div
                className={`p-4 rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${bgColorMap[color]}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-bold text-slate-900 text-lg capitalize">
                    {String(event.status || '').replace(/_/g, ' ')}
                  </h4>
                  <span className="text-xs font-medium text-slate-600 bg-white px-2.5 py-1 rounded-full">
                    {timestamp}
                  </span>
                </div>

                <p className="text-sm text-slate-700 mb-1 flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-slate-600 rounded-full" />
                  {location}
                </p>

                {remarks && (
                  <p className="text-sm text-slate-600 mt-2 italic">"{remarks}"</p>
                )}

                {deliveredTo && (
                  <div className="mt-3 p-2 bg-white bg-opacity-60 rounded border-l-2 border-green-500">
                    <p className="text-xs font-medium text-slate-700">
                      ✓ Received by: <span className="text-green-700 font-bold">{deliveredTo}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
