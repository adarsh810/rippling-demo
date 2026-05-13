'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import StepBar from '@/components/StepBar'
import { BulkChange, BulkChangeItem, DOWNSTREAM_SYSTEMS_MAP, DownstreamSystem } from '@/types'
import { supabase } from '@/lib/supabase'

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

  useEffect(() => {
    Promise.all([
      supabase.from('rpl_bulk_changes').select('*').eq('id', id).single(),
      fetch(`/api/bulk-change/items?bulk_change_id=${id}`).then(r => r.json()),
    ]).then(([{ data: c }, it]) => {
      setChange(c)
      setItems(Array.isArray(it) ? it : [])
      setLoading(false)
    })
  }, [id])

  const getDownstreamSystems = (): DownstreamSystem[] => {
    const attrs = [...new Set(items.map(i => i.attribute))]
    const systemMap = new Map<string, DownstreamSystem>()
    for (const attr of attrs) {
      const systems = DOWNSTREAM_SYSTEMS_MAP[attr] ?? []
      for (const s of systems) {
        const key = s.name
        if (!systemMap.has(key)) {
          systemMap.set(key, { ...s, affectedCount: items.filter(i => i.attribute === attr).length })
        } else {
          const existing = systemMap.get(key)!
          systemMap.set(key, { ...existing, affectedCount: existing.affectedCount + items.filter(i => i.attribute === attr && !systemMap.has(key)).length })
        }
      }
    }
    return [...systemMap.values()]
  }

  const downstream = getDownstreamSystems()
  const hardWarnings = downstream.filter(s => s.severity === 'hard')
  const softWarnings = downstream.filter(s => s.severity === 'soft')

  const uniqueEmployees = new Set(items.map(i => i.employee_id)).size
  const attrSummary = items.reduce((acc, i) => {
    acc[i.attribute] = (acc[i.attribute] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const handleSubmitForApproval = async () => {
    setSubmitting(true)
    await fetch('/api/bulk-change', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'pending_approval' }),
    })
    await supabase.from('rpl_audit_log').insert({
      bulk_change_id: id,
      action: 'submitted_for_approval',
      actor: 'Adarsh Attavar',
      details: { employee_count: uniqueEmployees, affected_systems: downstream.map(s => s.name) },
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
        mode: 'chat',
        question,
        employeeCount: uniqueEmployees,
        changes: items.map(i => ({
          employee_name: (i.employee as { name?: string })?.name ?? '',
          attribute: i.attribute,
          old_value: i.old_value ?? '',
          new_value: i.new_value,
        })),
      }),
    })
    const data = await r.json()
    setChatAnswer(data.answer ?? 'Could not get an answer.')
    setChatLoading(false)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading preview...</div>

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8"><StepBar current={4} /></div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Preview Changes</h1>
          <p className="text-gray-500 text-sm mt-1">
            {change?.status === 'draft' ? 'Review before committing to approval workflow' : `Status: ${change?.status?.replace(/_/g, ' ')}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
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

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
              <h2 className="font-semibold text-gray-900">Change Detail</h2>
              <div className="flex gap-2 ml-auto">
                {Object.entries(attrSummary).map(([attr, count]) => (
                  <span key={attr} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {attr} ×{count}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-y-auto max-h-80">
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
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {(item.employee as { name?: string })?.name ?? '—'}
                      </td>
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
          <p className="text-xs text-gray-400">This will affect {downstream.length} downstream systems across {uniqueEmployees} employee records.</p>

          {hardWarnings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2">Hard Warnings</p>
              {hardWarnings.map(s => (
                <div key={s.name} className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{s.icon}</span>
                    <span className="font-semibold text-sm text-red-800">{s.name}</span>
                    <span className="ml-auto text-xs bg-red-200 text-red-700 px-1.5 py-0.5 rounded font-medium">HARD</span>
                  </div>
                  <p className="text-xs text-red-700">{s.description}</p>
                </div>
              ))}
            </div>
          )}

          {softWarnings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-yellow-600 uppercase tracking-wide mb-2">Soft Warnings</p>
              {softWarnings.map(s => (
                <div key={s.name} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{s.icon}</span>
                    <span className="font-semibold text-sm text-yellow-800">{s.name}</span>
                    <span className="ml-auto text-xs bg-yellow-200 text-yellow-700 px-1.5 py-0.5 rounded font-medium">SOFT</span>
                  </div>
                  <p className="text-xs text-yellow-700">{s.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
          <button
            onClick={handleChat}
            disabled={!question.trim() || chatLoading}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
          >
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
        {(!change?.status || change.status === 'draft') ? (
          <button
            onClick={handleSubmitForApproval}
            disabled={submitting}
            className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit for Approval →'}
          </button>
        ) : (
          <button
            onClick={() => router.push(`/bulk-change/${id}/approve`)}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            {change.status === 'executed' || change.status === 'approved' ? 'View / Rollback →' : 'View Decision →'}
          </button>
        )}
      </div>
    </div>
  )
}
