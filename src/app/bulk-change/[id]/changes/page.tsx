'use client'

import { useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import StepBar from '@/components/StepBar'
import { Employee, BulkChange, EVENT_TEMPLATES } from '@/types'
import { supabase } from '@/lib/supabase'

interface ChangeRow {
  employee_id: string
  employee_name: string
  employee_title: string
  attribute: string
  old_value: string
  new_value: string
}

export default function ChangesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const employeeIds = searchParams.get('employees')?.split(',') ?? []

  const [change, setChange] = useState<BulkChange | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rows, setRows] = useState<ChangeRow[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [suggested, setSuggested] = useState(false)
  const [saving, setSaving] = useState(false)

  const [simpleAttr, setSimpleAttr] = useState('location')
  const [simpleValue, setSimpleValue] = useState('')

  useEffect(() => {
    supabase.from('rpl_bulk_changes').select('*').eq('id', id).single()
      .then(({ data }) => setChange(data))
    if (employeeIds.length > 0) {
      supabase.from('rpl_employees').select('*').in('id', employeeIds)
        .then(({ data }) => setEmployees(data ?? []))
    }
  }, [id])

  const getAISuggestions = async () => {
    if (!change || employees.length === 0) return
    setSuggesting(true)
    try {
      const r = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'suggest',
          eventType: change.event_type,
          changeType: change.change_type,
          employees: employees.map(e => ({
            name: e.name, department: e.department, title: e.title,
            location: e.location, compensation: e.compensation,
          })),
        }),
      })
      const suggestions = await r.json()
      if (Array.isArray(suggestions)) {
        const newRows: ChangeRow[] = []
        for (const s of suggestions) {
          const emp = employees.find(e => e.name === s.employee_name)
          if (!emp) continue
          const oldVal = String((emp as unknown as Record<string, unknown>)[s.attribute] ?? '')
          newRows.push({
            employee_id: emp.id,
            employee_name: emp.name,
            employee_title: emp.title,
            attribute: s.attribute,
            old_value: oldVal,
            new_value: String(s.new_value),
          })
        }
        setRows(newRows)
        setSuggested(true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSuggesting(false)
    }
  }

  const applySimpleChange = () => {
    if (!simpleValue.trim()) return
    const newRows: ChangeRow[] = employees.map(e => ({
      employee_id: e.id,
      employee_name: e.name,
      employee_title: e.title,
      attribute: simpleAttr,
      old_value: String((e as unknown as Record<string, unknown>)[simpleAttr] ?? ''),
      new_value: simpleValue.trim(),
    }))
    setRows(newRows)
    setSuggested(true)
  }

  const updateRow = (idx: number, field: 'attribute' | 'new_value', value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx))

  const handleContinue = async () => {
    if (rows.length === 0) return
    setSaving(true)
    await fetch('/api/bulk-change/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bulk_change_id: id,
        items: rows,
      }),
    })

    const systems = [...new Set(rows.flatMap(r => {
      const map: Record<string, string[]> = {
        compensation: ['Payroll', 'Benefits', 'Tax Engine'],
        location: ['Payroll', 'Benefits', 'Slack'],
        department: ['Slack', 'GitHub', 'Device Mgmt'],
        title: ['Org Chart', 'Slack'],
        manager_id: ['Org Chart', 'Slack'],
      }
      return map[r.attribute] ?? []
    }))]

    await fetch('/api/bulk-change', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, affected_systems: systems }),
    })

    router.push(`/bulk-change/${id}/preview`)
  }

  const template = EVENT_TEMPLATES.find(t => t.id === change?.event_type)
  const isSimple = change?.change_type === 'simple'
  const ATTRS = ['compensation', 'title', 'department', 'location']

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8"><StepBar current={3} /></div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isSimple ? 'Define Uniform Change' : 'AI-Suggested Changes per Employee'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {employees.length} employees · {change?.change_type} change
            {template && <> · {template.icon} {template.label}</>}
          </p>
        </div>
        {!isSimple && (
          <button
            onClick={getAISuggestions}
            disabled={suggesting || employees.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            {suggesting ? (
              <><span className="animate-spin inline-block">⟳</span> Thinking...</>
            ) : (
              <><span>✦</span> AI Suggest Changes</>
            )}
          </button>
        )}
      </div>

      {isSimple && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Apply same value to all {employees.length} employees</h2>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Attribute</label>
              <select
                value={simpleAttr}
                onChange={e => setSimpleAttr(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {ATTRS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">New Value</label>
              <input
                type={simpleAttr === 'compensation' ? 'number' : 'text'}
                placeholder={simpleAttr === 'compensation' ? '135000' : simpleAttr === 'location' ? 'Austin' : ''}
                value={simpleValue}
                onChange={e => setSimpleValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={applySimpleChange}
                disabled={!simpleValue.trim()}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-40"
              >Apply to All</button>
            </div>
          </div>
        </div>
      )}

      {!isSimple && !suggested && !suggesting && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-6 text-center">
          <p className="text-orange-700 text-sm mb-3">✦ AI will analyze each employee and suggest individualized changes based on the event context.</p>
          <button
            onClick={getAISuggestions}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
          >
            Generate AI Suggestions
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">{rows.length} change{rows.length !== 1 ? 's' : ''} staged</p>
            {suggested && <span className="text-xs text-orange-600 flex items-center gap-1"><span>✦</span> AI suggested</span>}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Employee', 'Attribute', 'Current Value', 'New Value', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{r.employee_name}</p>
                    <p className="text-gray-400 text-xs">{r.employee_title}</p>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={r.attribute}
                      onChange={e => updateRow(i, 'attribute', e.target.value)}
                      className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    >
                      {ATTRS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-sm">
                    {r.attribute === 'compensation' ? `$${parseFloat(r.old_value || '0').toLocaleString()}` : r.old_value}
                  </td>
                  <td className="px-5 py-3">
                    <input
                      type={r.attribute === 'compensation' ? 'number' : 'text'}
                      value={r.new_value}
                      onChange={e => updateRow(i, 'new_value', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => router.push(`/bulk-change/${id}/scope`)}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
        >← Back</button>
        <button
          onClick={handleContinue}
          disabled={rows.length === 0 || saving}
          className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving...' : 'Preview Changes →'}
        </button>
      </div>
    </div>
  )
}
