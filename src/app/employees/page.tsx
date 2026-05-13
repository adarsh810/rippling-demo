'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee } from '@/types'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ dept: '', vertical: '', location: '', search: '' })
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
  const verticals = ['full_time', 'hourly', 'contractor']

  const filtered = employees.filter(e => {
    if (filters.dept && e.department !== filters.dept) return false
    if (filters.vertical && e.vertical !== filters.vertical) return false
    if (filters.location && e.location !== filters.location) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!e.name.toLowerCase().includes(q) && !e.title.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q)) return false
    }
    return true
  })

  const avgComp = filtered.length
    ? Math.round(filtered.reduce((s, e) => s + e.compensation, 0) / filtered.length)
    : 0

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm mt-1">
            Live employee records — reflects executed bulk changes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Last refreshed {lastRefresh.toLocaleTimeString()}
          </span>
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

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Employees', value: filtered.length, sub: `of ${employees.length}` },
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

      <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4 flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, title, email..."
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
        <select
          value={filters.vertical}
          onChange={e => setFilters(f => ({ ...f, vertical: e.target.value }))}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">All Employment Types</option>
          {verticals.map(v => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
        </select>
        {(filters.dept || filters.vertical || filters.location || filters.search) && (
          <button
            onClick={() => setFilters({ dept: '', vertical: '', location: '', search: '' })}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Name', 'Title', 'Department', 'Location', 'Employment', 'Compensation'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">No employees match the filters.</td>
              </tr>
            ) : filtered.map(e => (
              <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{e.name}</p>
                  <p className="text-gray-400 text-xs">{e.email}</p>
                </td>
                <td className="px-5 py-3 text-gray-700">{e.title}</td>
                <td className="px-5 py-3 text-gray-700">{e.department}</td>
                <td className="px-5 py-3 text-gray-700">{e.location}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    e.vertical === 'full_time' ? 'bg-blue-100 text-blue-700' :
                    e.vertical === 'hourly'    ? 'bg-yellow-100 text-yellow-700' :
                                                 'bg-gray-100 text-gray-600'
                  }`}>{e.vertical.replace('_', ' ')}</span>
                </td>
                <td className="px-5 py-3 font-semibold text-gray-900">
                  ${e.compensation.toLocaleString()}
                </td>
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
