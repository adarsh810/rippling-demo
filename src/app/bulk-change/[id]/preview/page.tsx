'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import StepBar from '@/components/StepBar'
import { BulkChange, BulkChangeItem, DOWNSTREAM_SYSTEMS_MAP, DownstreamSystem } from '@/types'
import { supabase } from '@/lib/supabase'

// ── Important HR calendar events ─────────────────────────────────────────────
interface CalEvent { name: string; icon: string; date: Date }

function getUpcomingEvents(): CalEvent[] {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const events: CalEvent[] = []

  // Payroll: next 3 bi-weekly Fridays
  const nextFriday = (from: Date): Date => {
    const d = new Date(from)
    const dow = d.getDay()
    d.setDate(d.getDate() + (dow <= 5 ? 5 - dow || 7 : 6))
    return d
  }
  const p1 = nextFriday(today)
  const p2 = new Date(p1); p2.setDate(p2.getDate() + 14)
  const p3 = new Date(p2); p3.setDate(p3.getDate() + 14)
  events.push({ name: 'Payroll Run', icon: '💰', date: p1 })
  events.push({ name: 'Payroll Run', icon: '💰', date: p2 })
  events.push({ name: 'Payroll Run', icon: '💰', date: p3 })

  // Quarter-end close
  const m = today.getMonth()
  const qEnd = new Date(today.getFullYear(), Math.floor(m / 3) * 3 + 3, 0)
  if (qEnd > today) events.push({ name: 'Quarter-End Close', icon: '📊', date: qEnd })

  // Benefits enrollment deadline (~38 days out)
  const ben = new Date(today); ben.setDate(ben.getDate() + 38)
  events.push({ name: 'Benefits Enrollment Deadline', icon: '🏥', date: ben })

  // Tax filing: next April 15 or Oct 15
  const taxDates = [
    new Date(today.getFullYear(), 3, 15),
    new Date(today.getFullYear(), 9, 15),
    new Date(today.getFullYear() + 1, 3, 15),
  ].filter(d => d > today)
  if (taxDates.length) events.push({ name: 'Tax Filing Deadline', icon: '📋', date: taxDates[0] })

  return events.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5)
}

const UPCOMING_EVENTS = getUpcomingEvents()

function daysAway(d: Date): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0]
}

function isDateBlocked(dateStr: string): CalEvent | null {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  for (const ev of UPCOMING_EVENTS) {
    const windowStart = new Date(ev.date); windowStart.setDate(windowStart.getDate() - 3)
    if (d >= windowStart && d < ev.date) return ev
  }
  return null
}

export default function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [change, setChange] = useState<BulkChange | null>(null)
  const [items, setItems] = useState<BulkChangeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [question, setQuestion] = useState('')
  const [chatAnswer, setChatAnswer] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [executionDate, setExecutionDate] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('rpl_bulk_changes').select('*').eq('id', id).single(),
      fetch(`/api/bulk-change/items?bulk_change_id=${id}`).then(r => r.json()),
    ]).then(([{ data: c }, it]) => {
      setChange(c)
      setItems(Array.isArray(it) ? it : [])
      setLoading(false)
      if (c?.effective_date) setExecutionDate(c.effective_date)
    })
  }, [id])

  const getDownstreamSystems = (): DownstreamSystem[] => {
    const attrs = [...new Set(items.map(i => i.attribute))]
    const systemMap = new Map<string, DownstreamSystem>()
    for (const attr of attrs) {
      for (const s of (DOWNSTREAM_SYSTEMS_MAP[attr] ?? [])) {
        if (!systemMap.has(s.name)) {
          systemMap.set(s.name, { ...s, affectedCount: items.filter(i => i.attribute === attr).length })
        }
      }
    }
    return [...systemMap.values()]
  }

  const downstream = getDownstreamSystems()
  const hardWarnings = downstream.filter(s => s.severity === 'hard')
  const softWarnings = downstream.filter(s => s.severity === 'soft')
  const uniqueEmployees = new Set(items.map(i => i.employee_id)).size
  const attrSummary = items.reduce((acc, i) => { acc[i.attribute] = (acc[i.attribute] ?? 0) + 1; return acc }, {} as Record<string, number>)

  const blockedBy = isDateBlocked(executionDate)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const minDate = toYMD(today)
  const canSubmit = executionDate && !blockedBy

  const handleSubmitForApproval = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    await fetch('/api/bulk-change', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'pending_approval', effective_date: executionDate }),
    })
    await supabase.from('rpl_audit_log').insert({
      bulk_change_id: id,
      action: 'submitted_for_approval',
      actor: 'Adarsh Attavar',
      details: { employee_count: uniqueEmployees, effective_date: executionDate, affected_systems: downstream.map(s => s.name) },
    })
    router.push(`/bulk-change/${id}/approve`)
  }

  const handleChat = async () => {
    if (!question.trim()) return
    setChatLoading(true)
    const r = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'chat', question, employeeCount: uniqueEmployees,
        changes: items.map(i => ({
          employee_name: (i.employee as { name?: string })?.name ?? '',
          attribute: i.attribute, old_value: i.old_value ?? '', new_value: i.new_value,
        })),
      }),
    })
    const data = await r.json()
    setChatAnswer(data.answer ?? 'Could not get an answer.')
    setChatLoading(false)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading preview...</div>

  const isDraft = !change?.status || change.status === 'draft'

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8"><StepBar current={4} /></div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Preview Changes</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isDraft ? 'Review and set an execution date before submitting' : `Status: ${change?.status?.replace(/_/g, ' ')}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Employees Affected</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{uniqueEmployees}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Changes</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Downstream Systems</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{downstream.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6">
        <div className="md:col-span-2 overflow-x-auto">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
              <h2 className="font-semibold text-gray-900">Change Detail</h2>
              <div className="flex gap-2 ml-auto flex-wrap">
                {Object.entries(attrSummary).map(([attr, count]) => (
                  <span key={attr} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{attr} ×{count}</span>
                ))}
              </div>
            </div>
            <div className="overflow-y-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['Employee', 'Attribute', 'Current', 'New Value'].map(h => (
                      <th key={h} className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{(item.employee as { name?: string })?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-500">{item.attribute}</td>
                      <td className="px-5 py-3 text-gray-400 line-through">
                        {item.attribute === 'compensation' ? `$${parseFloat(item.old_value ?? '0').toLocaleString()}` : item.old_value}
                      </td>
                      <td className="px-5 py-3 font-semibold text-gray-900">
                        {item.attribute === 'compensation' ? `$${parseFloat(item.new_value).toLocaleString()}` : item.new_value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm">Blast Radius Preview</h2>
          <p className="text-xs text-gray-400">Affects {downstream.length} downstream systems across {uniqueEmployees} employee records.</p>
          {hardWarnings.map(s => (
            <div key={s.name} className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span>{s.icon}</span>
                <span className="font-semibold text-sm text-red-800">{s.name}</span>
                <span className="ml-auto text-xs bg-red-200 text-red-700 px-1.5 py-0.5 rounded font-medium">HARD</span>
              </div>
              <p className="text-xs text-red-700">{s.description}</p>
            </div>
          ))}
          {softWarnings.map(s => (
            <div key={s.name} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span>{s.icon}</span>
                <span className="font-semibold text-sm text-yellow-800">{s.name}</span>
                <span className="ml-auto text-xs bg-yellow-200 text-yellow-700 px-1.5 py-0.5 rounded font-medium">SOFT</span>
              </div>
              <p className="text-xs text-yellow-700">{s.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Execution date picker ── */}
      {isDraft && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📅</span>
            <h2 className="font-semibold text-gray-900">Execution Date</h2>
            <span className="text-xs text-gray-400 font-normal ml-1">When should this change take effect?</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date input */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Select date</label>
              <input
                type="date"
                value={executionDate}
                min={minDate}
                onChange={e => setExecutionDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {blockedBy && (
                <div className="mt-2 flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <span className="flex-shrink-0 mt-0.5">⛔</span>
                  <span>
                    <span className="font-semibold">{blockedBy.name}</span> is on {blockedBy.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
                    Changes cannot be executed within 3 days before this event.
                    Choose before {new Date(blockedBy.date.getTime() - 3 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} or on/after {blockedBy.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
                  </span>
                </div>
              )}
              {executionDate && !blockedBy && (
                <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
                  <span>✓</span> Execution date set · {new Date(executionDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>

            {/* Upcoming events */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Upcoming events</p>
              <div className="space-y-1.5">
                {UPCOMING_EVENTS.map((ev, i) => {
                  const days = daysAway(ev.date)
                  const windowStart = new Date(ev.date); windowStart.setDate(windowStart.getDate() - 3)
                  const blocked = executionDate && isDateBlocked(executionDate)?.name === ev.name && isDateBlocked(executionDate)?.date.getTime() === ev.date.getTime()
                  return (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${blocked ? 'bg-red-50 border border-red-200' : days <= 7 ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50 border border-gray-100'}`}>
                      <span className="text-sm">{ev.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{ev.name}</p>
                        <p className="text-gray-400">{ev.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · 3-day window: {windowStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–{new Date(ev.date.getTime() - 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      </div>
                      <span className={`flex-shrink-0 font-semibold ${days <= 3 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {days}d
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI chat */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-orange-500">✦</span>
          <p className="font-semibold text-sm text-gray-900">Ask AI about these changes</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="e.g. Which employees got a comp increase above 10%?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleChat()}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button onClick={handleChat} disabled={!question.trim() || chatLoading}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40">
            {chatLoading ? '...' : 'Ask'}
          </button>
        </div>
        {chatAnswer && (
          <div className="mt-3 p-3 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-800">{chatAnswer}</p>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">← Back</button>
        {isDraft ? (
          <div className="flex items-center gap-3">
            {!executionDate && <p className="text-xs text-gray-400">Set an execution date to continue</p>}
            <button
              onClick={handleSubmitForApproval}
              disabled={!canSubmit || submitting}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit for Approval →'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => router.push(`/bulk-change/${id}/approve`)}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            {['executed', 'approved', 'rolled_back'].includes(change?.status ?? '') ? 'View / Rollback →' : 'View Decision →'}
          </button>
        )}
      </div>
    </div>
  )
}
