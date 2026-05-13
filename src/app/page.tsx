'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BulkChange } from '@/types'
import StatusBadge from '@/components/StatusBadge'

export default function Dashboard() {
  const [changes, setChanges] = useState<BulkChange[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bulk-change')
      .then(r => r.json())
      .then(d => { setChanges(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const stats = {
    total: changes.length,
    executed: changes.filter(c => c.status === 'executed').length,
    pending: changes.filter(c => c.status === 'pending_approval').length,
    draft: changes.filter(c => c.status === 'draft').length,
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Change</h1>
          <p className="text-gray-500 text-sm mt-1">AI-powered multi-employee attribute updates</p>
        </div>
        <Link
          href="/bulk-change/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <span className="text-base leading-none">+</span> New Bulk Change
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Changes', value: stats.total, color: 'text-gray-900' },
          { label: 'Executed', value: stats.executed, color: 'text-green-600' },
          { label: 'Pending Approval', value: stats.pending, color: 'text-yellow-600' },
          { label: 'Drafts', value: stats.draft, color: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Bulk Changes</h2>
          <Link href="/audit" className="text-xs text-orange-500 hover:underline">View audit trail →</Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : changes.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm mb-4">No bulk changes yet.</p>
            <Link href="/bulk-change/new" className="text-orange-500 text-sm hover:underline">Create your first bulk change →</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Event', 'Type', 'Employees', 'Created By', 'Status', 'Date', ''].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {changes.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{c.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                    {c.event_description && (
                      <p className="text-gray-400 text-xs mt-0.5 truncate max-w-[200px]">{c.event_description}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${c.change_type === 'complex' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {c.change_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{c.employee_count}</td>
                  <td className="px-6 py-4 text-gray-600">{c.created_by}</td>
                  <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                  <td className="px-6 py-4 text-gray-400">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <Link
                      href={
                        c.status === 'draft' ? `/bulk-change/${c.id}/scope` :
                        c.status === 'pending_approval' ? `/bulk-change/${c.id}/approve` :
                        c.status === 'executed' || c.status === 'approved' || c.status === 'rolled_back' || c.status === 'rejected' ? `/bulk-change/${c.id}/approve` :
                        `/bulk-change/${c.id}/preview`
                      }
                      className="text-orange-500 hover:underline text-xs"
                    >
                      {c.status === 'draft' ? 'Continue →' : 'View →'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
