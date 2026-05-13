'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee, VERTICAL_ATTRS } from '@/types'

type VerticalTab = 'all' | 'full_time' | 'hourly' | 'contractor'

const VERTICAL_LABELS: Record<VerticalTab, string> = {
  all:        'All',
  full_time:  'Full-time',
  hourly:     'Hourly',
  contractor: 'Contractor',
}

const VERTICAL_COLORS: Record<string, string> = {
  full_time:  'bg-blue-100 text-blue-700',
  hourly:     'bg-yellow-100 text-yellow-700',
  contractor: 'bg-gray-100 text-gray-600',
}

function formatVal(key: string, val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (key === 'equity_grant' || key === 'compensation') return `$${Number(val).toLocaleString()}`
  if (key === 'bill_rate' || key === 'hourly_rate') return `$${Number(val).toFixed(2)}/hr`
  if (key === 'bonus_target') return `${val}%`
  if (key === 'overtime_eligible') return val ? 'Yes' : 'No'
  if (key === 'contract_end_date') return new Date(String(val)).toLocaleDateString()
  return String(val)
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<VerticalTab>('all')
  const [filters, setFilters] = useState({ dept: '', location: '', search: '' })
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('rpl_employees').select('*').order('name')
    setEmployees(data ?? [])
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const depts = [...new Set(employees.map(e => e.department))].sort()
  const locations = [...new Set(employees.map(e => e.location))].sort()

  const filtered = employees.filter(e => {
    if (tab !== 'all' && e.vertical !== tab) return false
    if (filters.dept && e.department !== filters.dept) return false
    if (filters.location && e.location !== filters.location) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !e.name.toLowerCase().includes(q) &&
        !e.title.toLowerCase().includes(q) &&
        !(e.work_email ?? e.email).toLowerCase().includes(q) &&
        !(e.manager ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const avgComp = filtered.length
    ? Math.round(filtered.reduce((s, e) => s + e.compensation, 0) / filtered.length)
    : 0

  const verticalAttrs = tab !== 'all' ? (VERTICAL_ATTRS[tab] ?? []) : []
  const activeVerticals: VerticalTab[] = ['all', 'full_time', 'hourly', 'contractor']
  const countByVertical = (v: VerticalTab) => v === 'all' ? employees.length : employees.filter(e => e.vertical === v).length

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm mt-1">Live records — reflects executed bulk changes</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Refreshed {lastRefresh.toLocaleTimeString()}</span>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>⟳</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Vertical tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {activeVerticals.map(v => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {VERTICAL_LABELS[v]}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              tab === v ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500'
            }`}>{countByVertical(v)}</span>
          </button>
        ))}
      </div>

      {/* Vertical-specific attribute banner */}
      {tab !== 'all' && verticalAttrs.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 mb-5 flex items-center gap-4">
          <span className="text-xs font-semibold text-blue-500 uppercase tracking-wide">{VERTICAL_LABELS[tab]}-specific</span>
          <div className="flex gap-4">
            {verticalAttrs.map(a => (
              <span key={a.key} className="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded font-medium">{a.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Showing', value: filtered.length, sub: `of ${employees.length} total` },
          { label: 'Avg Compensation', value: `$${avgComp.toLocaleString()}`, sub: 'filtered set' },
          { label: 'Departments', value: new Set(filtered.map(e => e.department)).size, sub: 'represented' },
          { label: 'Locations', value: new Set(filtered.map(e => e.location)).size, sub: 'represented' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4 flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search name, title, email, manager..."
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <select
          value={filters.dept}
          onChange={e => setFilters(f => ({ ...f, dept: e.target.value }))}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">All Departments</option>
          {depts.map(d => <option key={d}>{d}</option>)}
        </select>
        <select
          value={filters.location}
          onChange={e => setFilters(f => ({ ...f, location: e.target.value }))}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">All Locations</option>
          {locations.map(l => <option key={l}>{l}</option>)}
        </select>
        {(filters.dept || filters.location || filters.search) && (
          <button
            onClick={() => setFilters({ dept: '', location: '', search: '' })}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name & Work Email</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Title</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Manager</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Dept / Location</th>
              {tab === 'all' && (
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
              )}
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Compensation</th>
              {verticalAttrs.map(a => (
                <th key={a.key} className="text-left px-5 py-3 text-xs font-medium text-blue-500 uppercase tracking-wide">{a.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={10} className="px-5 py-12 text-center text-gray-400 text-sm">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-5 py-12 text-center text-gray-400 text-sm">No employees match the filters.</td></tr>
            ) : filtered.map(e => (
              <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{e.name}</p>
                  <p className="text-gray-400 text-xs">{e.work_email ?? e.email}</p>
                </td>
                <td className="px-5 py-3 text-gray-700">{e.title}</td>
                <td className="px-5 py-3 text-gray-500 text-sm">{e.manager ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-3">
                  <p className="text-gray-700">{e.department}</p>
                  <p className="text-gray-400 text-xs">{e.location}</p>
                </td>
                {tab === 'all' && (
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${VERTICAL_COLORS[e.vertical] ?? 'bg-gray-100 text-gray-600'}`}>
                      {e.vertical.replace('_', ' ')}
                    </span>
                  </td>
                )}
                <td className="px-5 py-3 font-semibold text-gray-900">${e.compensation.toLocaleString()}</td>
                {verticalAttrs.map(a => (
                  <td key={a.key} className="px-5 py-3 text-gray-700">
                    {formatVal(a.key, (e as unknown as Record<string, unknown>)[a.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            Showing {filtered.length} of {employees.length} employees
          </div>
        )}
      </div>
    </div>
  )
}
