'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import StepBar from '@/components/StepBar'
import { BulkChange, BulkChangeItem } from '@/types'
import { supabase } from '@/lib/supabase'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'

export default function ApprovePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [change, setChange] = useState<BulkChange | null>(null)
  const [items, setItems] = useState<BulkChangeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const [executing, setExecuting] = useState(false)
  const [done, setDone] = useState(false)
  const [result, setResult] = useState<{ status: string } | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('rpl_bulk_changes').select('*').eq('id', id).single(),
      fetch(`/api/bulk-change/items?bulk_change_id=${id}`).then(r => r.json()),
    ]).then(([{ data: c }, it]) => {
      setChange(c)
      setItems(Array.isArray(it) ? it : [])
      setLoading(false)
      if (c && c.status !== 'pending_approval' && c.status !== 'draft') {
        setDone(true)
        setResult({ status: c.status })
      }
    })
  }, [id])

  const handleExecute = async () => {
    if (!action) return
    if (action === 'reject' && !reason.trim()) return
    setExecuting(true)

    const r = await fetch('/api/bulk-change/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, reason }),
    })
    const data = await r.json()
    setResult(data)
    setDone(true)
    setExecuting(false)
  }

  const handleRollback = async () => {
    if (!reason.trim()) {
      alert('Rollback reason is required.')
      return
    }
    setExecuting(true)
    const r = await fetch('/api/bulk-change/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'rollback', reason }),
    })
    const data = await r.json()
    setResult(data)
    setDone(true)
    setExecuting(false)
  }

  const uniqueEmployees = new Set(items.map(i => i.employee_id)).size

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>

  if (done && result) {
    const status = result.status as string
    const isExecuted = status === 'executed'
    const isRolledBack = status === 'rolled_back'
    const isRejected = status === 'rejected'

    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="mb-8"><StepBar current={5} /></div>
        <div className={`rounded-2xl p-8 text-center border ${
          isExecuted ? 'bg-green-50 border-green-200' :
          isRolledBack ? 'bg-purple-50 border-purple-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="text-4xl mb-3">
            {isExecuted ? '✅' : isRolledBack ? '↩️' : '❌'}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isExecuted ? 'Changes Executed Successfully' : isRolledBack ? 'Changes Rolled Back' : 'Change Rejected'}
          </h2>
          <p className="text-gray-600 text-sm mb-6">
            {isExecuted && `${uniqueEmployees} employees updated. Downstream systems are propagating changes.`}
            {isRolledBack && 'All employee attributes have been reverted to their original values.'}
            {isRejected && `Reason: ${change?.rejection_reason ?? reason}`}
          </p>
          {isExecuted && change?.rollback_window_expires_at && (
            <div className="bg-white rounded-lg border border-green-200 p-3 mb-6 text-left">
              <p className="text-xs text-gray-500 mb-1">Rollback window closes</p>
              <p className="font-semibold text-sm text-gray-900">
                {new Date(change.rollback_window_expires_at).toLocaleString()}
              </p>
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Reason for rollback (required)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                />
                <button
                  onClick={handleRollback}
                  disabled={executing || !reason.trim()}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-40"
                >
                  {executing ? 'Rolling back...' : '↩ Roll Back Changes'}
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Link href="/" className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              ← Dashboard
            </Link>
            <Link href="/audit" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800">
              View Audit Trail
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8"><StepBar current={5} /></div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Approver Review</h1>
          <p className="text-gray-500 text-sm mt-1">Reviewing as <span className="font-medium text-gray-700">Jordan Hayes · HR Admin</span></p>
        </div>
        {change && <StatusBadge status={change.status} />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3 text-sm">Change Summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Event</dt>
              <dd className="font-medium text-gray-900">{change?.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Type</dt>
              <dd className="font-medium text-gray-900">{change?.change_type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Employees Affected</dt>
              <dd className="font-bold text-gray-900">{uniqueEmployees}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Total Changes</dt>
              <dd className="font-bold text-gray-900">{items.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Initiated By</dt>
              <dd className="font-medium text-gray-900">{change?.created_by}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Affected Systems</dt>
              <dd className="font-medium text-gray-900">{change?.affected_systems?.length ?? 0}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3 text-sm">Sample Changes</h2>
          <div className="space-y-2 overflow-y-auto max-h-48">
            {items.slice(0, 8).map(item => (
              <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                <span className="text-gray-700 font-medium">{(item.employee as { name?: string })?.name ?? '—'}</span>
                <span className="text-gray-400 text-xs">{item.attribute}</span>
                <span className="text-gray-400 text-xs line-through">
                  {item.attribute === 'compensation' ? `$${parseFloat(item.old_value ?? '0').toLocaleString()}` : item.old_value}
                </span>
                <span className="text-green-700 text-xs font-semibold">
                  {item.attribute === 'compensation' ? `$${parseFloat(item.new_value).toLocaleString()}` : item.new_value}
                </span>
              </div>
            ))}
            {items.length > 8 && <p className="text-xs text-gray-400 text-center">+{items.length - 8} more</p>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 text-sm">Approval Decision</h2>
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setAction('approve')}
            className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
              action === 'approve'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            ✓ Approve & Execute
          </button>
          <button
            onClick={() => setAction('reject')}
            className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
              action === 'reject'
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            ✕ Reject
          </button>
        </div>

        {action === 'reject' && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Rejection Reason (required)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain why this change is being rejected..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        )}

        {action === 'approve' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-green-700">
              Approving will immediately update {uniqueEmployees} employee records and propagate changes across {change?.affected_systems?.length ?? 0} downstream systems.
              A 24-hour rollback window will be available after execution.
            </p>
          </div>
        )}

        <button
          onClick={handleExecute}
          disabled={!action || executing || (action === 'reject' && !reason.trim())}
          className={`w-full py-3 rounded-xl font-medium text-sm transition-colors ${
            action === 'approve'
              ? 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-40'
              : action === 'reject'
              ? 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-40'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          {executing ? 'Processing...' : action === 'approve' ? '✓ Approve & Execute Changes' : action === 'reject' ? '✕ Reject Change' : 'Select a decision above'}
        </button>
      </div>
    </div>
  )
}
