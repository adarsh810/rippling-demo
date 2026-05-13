'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import StepBar from '@/components/StepBar'
import { Employee, BulkChange } from '@/types'
import { supabase } from '@/lib/supabase'

export default function ScopePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [change, setChange] = useState<BulkChange | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({ dept: '', vertical: '', location: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('rpl_bulk_changes').select('*').eq('id', id).single()
      .then(({ data }) => setChange(data))
    supabase.from('rpl_employees').select('*').order('name')
      .then(({ data }) => setEmployees(data ?? []))
  }, [id])

  const depts = [...new Set(employees.map(e => e.department))].sort()
  const locations = [...new Set(employees.map(e => e.location))].sort()
  const verticals = ['full_time', 'hourly', 'contractor']

  const filtered = employees.filter(e => {
    if (filters.dept && e.department !== filters.dept) return false
    if (filters.vertical && e.vertical !== filters.vertical) return false
    if (filters.location && e.location !== filters.location) return false
    return true
  })

  const toggleAll = () => {
    if (filtered.every(e => selected.has(e.id))) {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(e => n.delete(e.id)); return n })
    } else {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(e => n.add(e.id)); return n })
    }
  }

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const handleContinue = async () => {
    if (selected.size === 0) return
    setSaving(true)
    await fetch('/api/bulk-change', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, employee_count: selected.size, status: 'draft' }),
    })
    const ids = [...selected].join(',')
    router.push(`/bulk-change/${id}/changes?employees=${ids}`)
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8"><StepBar current={2} /></div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Scope Employees</h1>
          <p className="text-gray-500 text-sm mt-1">
            {change && <><span className="font-medium text-gray-700">{change.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span> · {change.change_type} change</>}
          </p>
        </div>
        <div className="text-sm text-gray-500">
          <span className="font-semibold text-orange-500">{selected.size}</span> employee{selected.size !== 1 ? 's' : ''} selected
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 mb-4 p-3 md:p-4 flex flex-col sm:flex-row gap-2 md:gap-4">
        <select
          value={filters.dept}
          onChange={e => setFilters(f => ({ ...f, dept: e.target.value }))}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">All Departments</option>
          {depts.map(d => <option key={d}>{d}</option>)}
        </select>
        <select
          value={filters.vertical}
          onChange={e => setFilters(f => ({ ...f, vertical: e.target.value }))}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">All Employment Types</option>
          {verticals.map(v => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
        </select>
        <select
          value={filters.location}
          onChange={e => setFilters(f => ({ ...f, location: e.target.value }))}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">All Locations</option>
          {locations.map(l => <option key={l}>{l}</option>)}
        </select>
        <button
          onClick={() => setFilters({ dept: '', vertical: '', location: '' })}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
        >Clear</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every(e => selected.has(e.id))}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
              </th>
              {['Name', 'Title', 'Department', 'Location', 'Employment', 'Compensation'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(e => (
              <tr
                key={e.id}
                onClick={() => toggle(e.id)}
                className={`cursor-pointer transition-colors ${selected.has(e.id) ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    onClick={ev => ev.stopPropagation()}
                    className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{e.name}</p>
                  <p className="text-gray-400 text-xs">{e.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{e.title}</td>
                <td className="px-4 py-3 text-gray-600">{e.department}</td>
                <td className="px-4 py-3 text-gray-600">{e.location}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    e.vertical === 'full_time' ? 'bg-blue-100 text-blue-700' :
                    e.vertical === 'hourly' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{e.vertical.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">${e.compensation.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">No employees match the current filters.</div>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={() => router.push('/bulk-change/new')} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">← Back</button>
        <button
          onClick={handleContinue}
          disabled={selected.size === 0 || saving}
          className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving...' : `Continue with ${selected.size} employee${selected.size !== 1 ? 's' : ''} →`}
        </button>
      </div>
    </div>
  )
}
