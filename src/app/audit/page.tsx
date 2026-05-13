'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BulkChange, AuditLog } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'

const ACTION_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  created:                { label: 'Created',             icon: '📝', color: 'bg-gray-100 text-gray-600' },
  submitted_for_approval: { label: 'Submitted',           icon: '📤', color: 'bg-yellow-100 text-yellow-700' },
  approved:               { label: 'Approved',            icon: '✓',  color: 'bg-blue-100 text-blue-700' },
  rejected:               { label: 'Rejected',            icon: '✕',  color: 'bg-red-100 text-red-700' },
  executed:               { label: 'Executed',            icon: '⚡', color: 'bg-green-100 text-green-700' },
  rolled_back:            { label: 'Rolled Back',         icon: '↩',  color: 'bg-purple-100 text-purple-700' },
}

interface BulkChangeWithLogs extends BulkChange {
  logs: AuditLog[]
}

export default function AuditPage() {
  const [items, setItems] = useState<BulkChangeWithLogs[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      supabase.from('rpl_bulk_changes').select('*').order('created_at', { ascending: false }),
      supabase.from('rpl_audit_log').select('*').order('created_at', { ascending: true }),
    ]).then(([{ data: changes }, { data: logs }]) => {
      const logsByChange = (logs ?? []).reduce<Record<string, AuditLog[]>>((acc, l) => {
        if (!l.bulk_change_id) return acc
        acc[l.bulk_change_id] = [...(acc[l.bulk_change_id] ?? []), l]
        return acc
      }, {})
      const merged = (changes ?? []).map(c => ({
        ...c,
        logs: logsByChange[c.id] ?? [],
      }))
      setItems(merged)
      // Auto-expand the first one
      if (merged.length > 0) setExpanded(new Set([merged[0].id]))
      setLoading(false)
    })
  }, [])

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const lastAction = (logs: AuditLog[]) => logs[logs.length - 1]?.action ?? 'created'

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
          <p className="text-gray-500 text-sm mt-1">Immutable log — each bulk change with full action history</p>
        </div>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No bulk changes yet.</div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const isOpen = expanded.has(item.id)
            const last = lastAction(item.logs)
            const lastCfg = ACTION_CONFIG[last] ?? ACTION_CONFIG.created

            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header row — clickable */}
                <button
                  onClick={() => toggle(item.id)}
                  className="w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Chevron */}
                  <span className={`text-gray-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-90' : ''} inline-block`}>
                    ▶
                  </span>

                  {/* Event name + type */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">
                        {item.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        item.change_type === 'complex' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>{item.change_type}</span>
                    </div>
                    {item.event_description && (
                      <p className="text-gray-400 text-xs mt-0.5 truncate max-w-sm">{item.event_description}</p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-6 text-sm text-gray-500 flex-shrink-0">
                    <span>{item.employee_count} employees</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    <span>by {item.created_by.split(' ')[0]}</span>
                  </div>

                  {/* Status */}
                  <StatusBadge status={item.status} />

                  {/* Action count */}
                  <span className="text-xs text-gray-400 ml-2">
                    {item.logs.length} action{item.logs.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {/* Expanded action log */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
                    {item.logs.length === 0 ? (
                      <p className="text-xs text-gray-400">No audit events recorded.</p>
                    ) : (
                      <ol className="relative border-l border-gray-200 ml-3 space-y-4">
                        {item.logs.map((log, i) => {
                          const cfg = ACTION_CONFIG[log.action] ?? { label: log.action, icon: '•', color: 'bg-gray-100 text-gray-600' }
                          const isLatest = i === item.logs.length - 1
                          return (
                            <li key={log.id} className="ml-5">
                              {/* Dot */}
                              <span className={`absolute -left-[9px] w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[10px] ${
                                isLatest ? 'bg-orange-500' : 'bg-gray-300'
                              }`} />

                              <div className="flex items-start gap-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${cfg.color}`}>
                                  {cfg.icon} {cfg.label}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm text-gray-700 font-medium">{log.actor}</span>
                                    <span className="text-xs text-gray-400">
                                      {new Date(log.created_at).toLocaleDateString()} at {new Date(log.created_at).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  {log.details && Object.keys(log.details).length > 0 && (
                                    <div className="flex flex-wrap gap-3 mt-1">
                                      {Object.entries(log.details).map(([k, v]) => (
                                        <span key={k} className="text-xs text-gray-500">
                                          <span className="text-gray-400">{k.replace(/_/g, ' ')}:</span>{' '}
                                          {String(v).length > 60 ? String(v).slice(0, 60) + '…' : String(v)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </li>
                          )
                        })}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
