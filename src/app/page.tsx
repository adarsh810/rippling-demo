'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BulkChange, BulkChangeStatus } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import { useAuth } from '@/lib/auth-context'

const PAGE_SIZE = 10

type FilterKey = 'all' | 'executed' | 'approved' | 'pending_approval' | 'rejected' | 'draft'

export default function Dashboard() {
  const { persona } = useAuth()
  const [changes, setChanges] = useState<BulkChange[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    // Auto-execute sweep: promotes approved changes whose effective_date has arrived
    fetch('/api/bulk-change/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'auto_execute' }),
    }).finally(() => {
      fetch('/api/bulk-change')
        .then(r => r.json())
        .then(d => { setChanges(Array.isArray(d) ? d : []); setLoading(false) })
        .catch(() => setLoading(false))
    })
  }, [])

  // Approvers never see drafts
  const visible = persona === 'approver'
    ? changes.filter(c => c.status !== 'draft')
    : changes

  const executed = visible.filter(c => c.status === 'executed').length
  const approved = visible.filter(c => c.status === 'approved').length
  const pending  = visible.filter(c => c.status === 'pending_approval').length
  const rejected = visible.filter(c => c.status === 'rejected').length
  const draft    = visible.filter(c => c.status === 'draft').length

  type Tile = { key: FilterKey; label: string; value: number; color: string; activeColor: string }

  const tiles: Tile[] = [
    { key: 'all',              label: 'Total',     value: visible.length, color: 'text-gray-900',   activeColor: 'border-gray-700 bg-gray-50' },
    { key: 'pending_approval', label: 'Pending',   value: pending,        color: 'text-yellow-600', activeColor: 'border-yellow-500 bg-yellow-50' },
    { key: 'approved',         label: 'Approved',  value: approved,       color: 'text-blue-600',   activeColor: 'border-blue-500 bg-blue-50' },
    { key: 'executed',         label: 'Executed',  value: executed,       color: 'text-green-600',  activeColor: 'border-green-500 bg-green-50' },
    { key: 'rejected',         label: 'Rejected',  value: rejected,       color: 'text-red-500',    activeColor: 'border-red-400 bg-red-50' },
    ...(persona === 'admin'
      ? [{ key: 'draft' as FilterKey, label: 'Drafts', value: draft, color: 'text-gray-400', activeColor: 'border-gray-400 bg-gray-50' }]
      : []),
  ]

  const filtered = filter === 'all'
    ? visible
    : visible.filter(c => c.status === (filter as BulkChangeStatus))

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const setFilterAndReset = (f: FilterKey) => { setFilter(f); setPage(1) }

  const viewHref = (c: BulkChange) => {
    if (persona === 'approver') return `/bulk-change/${c.id}/approve`
    if (c.status === 'draft') return `/bulk-change/${c.id}/scope`
    return `/bulk-change/${c.id}/approve`
  }

  const viewLabel = (c: BulkChange) =>
    persona !== 'approver' && c.status === 'draft' ? 'Continue →' : 'View →'

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Change Monitoring</h1>
          <p className="text-gray-500 text-sm mt-1">AI-powered multi-employee attribute updates</p>
        </div>
        {persona === 'admin' && (
          <Link
            href="/bulk-change/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <span className="text-base leading-none">+</span> New Bulk Change
          </Link>
        )}
      </div>

      <div className={`grid gap-3 md:gap-4 mb-6 md:mb-8 ${persona === 'admin' ? 'grid-cols-3 md:grid-cols-6' : 'grid-cols-3 md:grid-cols-5'}`}>
        {tiles.map(t => (
          <button
            key={t.key}
            onClick={() => setFilterAndReset(t.key)}
            className={`text-left bg-white rounded-xl border-2 p-5 transition-all hover:shadow-sm ${
              filter === t.key ? t.activeColor : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-xs text-gray-500 uppercase tracking-wide">{t.label}</p>
            <p className={`text-3xl font-bold mt-1 ${t.color}`}>{t.value}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            {filter === 'all' ? 'All Changes' : tiles.find(t => t.key === filter)?.label}
            {filtered.length > 0 && <span className="ml-2 text-sm font-normal text-gray-400">({filtered.length})</span>}
          </h2>
          <Link href="/audit" className="text-xs text-indigo-500 hover:text-indigo-700">View audit trail →</Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm mb-4">
              {filter === 'all'
                ? 'No changes yet.'
                : `No ${tiles.find(t => t.key === filter)?.label.toLowerCase()} changes.`}
            </p>
            {filter === 'all' && persona === 'admin' && (
              <Link href="/bulk-change/new" className="text-indigo-500 text-sm hover:underline">
                Create your first bulk change →
              </Link>
            )}
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Event', 'Type', 'Employees', 'Created By', 'Status', 'Date', ''].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">
                        {c.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      {c.event_description && (
                        <p className="text-gray-400 text-xs mt-0.5 truncate max-w-[200px]">{c.event_description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        c.change_type === 'complex' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {c.change_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{c.employee_count}</td>
                    <td className="px-6 py-4 text-gray-600">{c.created_by}</td>
                    <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                    <td className="px-6 py-4 text-gray-400">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <Link href={viewHref(c)} className="text-indigo-500 hover:text-indigo-700 text-xs">
                        {viewLabel(c)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                <span>{filtered.length} changes · page {page} of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >←</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1.5 rounded-lg border transition-colors ${
                        p === page ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >{p}</button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >→</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
