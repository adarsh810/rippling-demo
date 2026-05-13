'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AuditLog } from '@/types'
import Link from 'next/link'

const ACTION_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  created:               { label: 'Created', icon: '📝', color: 'bg-gray-100 text-gray-600' },
  submitted_for_approval:{ label: 'Submitted', icon: '📤', color: 'bg-yellow-100 text-yellow-700' },
  approved:              { label: 'Approved', icon: '✓', color: 'bg-blue-100 text-blue-700' },
  rejected:              { label: 'Rejected', icon: '✕', color: 'bg-red-100 text-red-700' },
  executed:              { label: 'Executed', icon: '⚡', color: 'bg-green-100 text-green-700' },
  rolled_back:           { label: 'Rolled Back', icon: '↩', color: 'bg-purple-100 text-purple-700' },
}

export default function AuditPage() {
  const [logs, setLogs] = useState<(AuditLog & { bulk_change?: { event_type: string } })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('rpl_audit_log')
      .select('*, bulk_change:rpl_bulk_changes(event_type, change_type)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setLogs(data ?? []); setLoading(false) })
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
          <p className="text-gray-500 text-sm mt-1">Immutable log of all bulk change activity</p>
        </div>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">No audit events yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Timestamp', 'Event', 'Action', 'Actor', 'Details'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => {
                const cfg = ACTION_CONFIG[log.action] ?? { label: log.action, icon: '•', color: 'bg-gray-100 text-gray-600' }
                const bc = log.bulk_change as { event_type?: string; change_type?: string } | undefined
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-500 text-xs whitespace-nowrap">
                      <p>{new Date(log.created_at).toLocaleDateString()}</p>
                      <p className="text-gray-400">{new Date(log.created_at).toLocaleTimeString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      {bc?.event_type ? (
                        <div>
                          <p className="font-medium text-gray-900">
                            {bc.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          {bc.change_type && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${bc.change_type === 'complex' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {bc.change_type}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{log.actor}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <ul className="space-y-0.5">
                          {Object.entries(log.details).slice(0, 3).map(([k, v]) => (
                            <li key={k}><span className="text-gray-400">{k}:</span> {String(v)}</li>
                          ))}
                        </ul>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
