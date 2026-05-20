'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
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

type EditForm = Partial<Record<string, string | number | boolean>>

const AGENCIES = [
  'TechStaff Solutions', 'Apex Consulting', 'Talent Bridge',
  'Prime Resources', 'NextGen Staffing', 'Catalyst Group', 'Summit Professionals',
]

function EditPanel({ employee, onClose, onSaved, depts, locations, managers }: {
  employee: Employee
  onClose: () => void
  onSaved: (updated: Employee) => void
  depts: string[]
  locations: string[]
  managers: string[]
}) {
  const [form, setForm] = useState<EditForm>({
    name:              employee.name,
    title:             employee.title,
    department:        employee.department,
    location:          employee.location,
    manager:           employee.manager ?? '',
    compensation:      employee.compensation,
    equity_grant:      employee.equity_grant ?? '',
    pto_days:          employee.pto_days ?? '',
    bonus_target:      employee.bonus_target ?? '',
    hourly_rate:       employee.hourly_rate ?? '',
    overtime_eligible: employee.overtime_eligible ?? false,
    shift_type:        employee.shift_type ?? '',
    bill_rate:         employee.bill_rate ?? '',
    agency_name:       employee.agency_name ?? '',
    contract_end_date: employee.contract_end_date ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string | number | boolean) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    setError('')
    const payload: Record<string, unknown> = {
      name:       form.name,
      title:      form.title,
      department: form.department,
      location:   form.location,
      manager:    form.manager || null,
      compensation: Number(form.compensation),
    }
    if (employee.vertical === 'full_time') {
      payload.equity_grant = form.equity_grant !== '' ? Number(form.equity_grant) : null
      payload.pto_days     = form.pto_days !== '' ? Number(form.pto_days) : null
      payload.bonus_target = form.bonus_target !== '' ? Number(form.bonus_target) : null
    }
    if (employee.vertical === 'hourly') {
      payload.hourly_rate       = form.hourly_rate !== '' ? Number(form.hourly_rate) : null
      payload.overtime_eligible = form.overtime_eligible
      payload.shift_type        = form.shift_type || null
    }
    if (employee.vertical === 'contractor') {
      payload.bill_rate         = form.bill_rate !== '' ? Number(form.bill_rate) : null
      payload.agency_name       = form.agency_name || null
      payload.contract_end_date = form.contract_end_date || null
    }
    const { data, error: err } = await supabase
      .from('rpl_employees')
      .update(payload)
      .eq('id', employee.id)
      .select()
      .single()
    if (err) { setError(err.message); setSaving(false); return }
    onSaved(data as Employee)
    onClose()
  }

  const field = (label: string, key: string, type: 'text' | 'number' = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={String(form[key] ?? '')}
        onChange={e => set(key, e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  )

  const dropdown = (label: string, key: string, options: string[], allowCustom = false) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {allowCustom ? (
        <input
          list={`${key}-list`}
          value={String(form[key] ?? '')}
          onChange={e => set(key, e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
        </input>
      ) : null}
      {allowCustom && (
        <datalist id={`${key}-list`}>
          {options.map(o => <option key={o} value={o} />)}
        </datalist>
      )}
      {!allowCustom && (
        <select
          value={String(form[key] ?? '')}
          onChange={e => set(key, e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">{employee.name}</p>
            <p className="text-xs text-gray-400">{employee.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Core Info</p>
          {field('Name', 'name')}
          {field('Title', 'title')}
          {dropdown('Department', 'department', depts)}
          {dropdown('Location', 'location', locations)}
          {dropdown('Manager', 'manager', managers, true)}
          {field('Compensation ($)', 'compensation', 'number')}

          {employee.vertical === 'full_time' && (
            <>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide pt-2">Full-time Fields</p>
              {field('Equity Grant ($)', 'equity_grant', 'number')}
              {field('PTO Days', 'pto_days', 'number')}
              {field('Bonus Target (%)', 'bonus_target', 'number')}
            </>
          )}

          {employee.vertical === 'hourly' && (
            <>
              <p className="text-xs font-semibold text-yellow-500 uppercase tracking-wide pt-2">Hourly Fields</p>
              {field('Hourly Rate ($)', 'hourly_rate', 'number')}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Shift Type</label>
                <select
                  value={String(form.shift_type ?? '')}
                  onChange={e => set('shift_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">—</option>
                  {['morning', 'afternoon', 'evening', 'night'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="ot"
                  type="checkbox"
                  checked={Boolean(form.overtime_eligible)}
                  onChange={e => set('overtime_eligible', e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <label htmlFor="ot" className="text-sm text-gray-700">Overtime eligible</label>
              </div>
            </>
          )}

          {employee.vertical === 'contractor' && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Contractor Fields</p>
              {field('Bill Rate ($/hr)', 'bill_rate', 'number')}
              {dropdown('Agency Name', 'agency_name', AGENCIES, true)}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Contract End Date</label>
                <input
                  type="date"
                  value={String(form.contract_end_date ?? '')}
                  onChange={e => set('contract_end_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<VerticalTab>('all')
  const [filters, setFilters] = useState({ dept: '', location: '', search: '' })
  const [editing, setEditing] = useState<Employee | null>(null)
  const [page, setPage] = useState(1)

  const PAGE_SIZE = 15

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('rpl_employees').select('*').order('name')
    setEmployees(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaved = (updated: Employee) => {
    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e))
  }

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const avgComp = filtered.length
    ? Math.round(filtered.reduce((s, e) => s + e.compensation, 0) / filtered.length)
    : 0

  const verticalAttrs = tab !== 'all' ? (VERTICAL_ATTRS[tab] ?? []) : []
  const setTabAndReset = (v: VerticalTab) => { setTab(v); setPage(1) }
  const setFiltersAndReset = (f: typeof filters) => { setFilters(f); setPage(1) }

  const activeVerticals: VerticalTab[] = ['all', 'full_time', 'hourly', 'contractor']
  const countByVertical = (v: VerticalTab) => v === 'all' ? employees.length : employees.filter(e => e.vertical === v).length

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm mt-1">Click any row to edit · changes apply instantly</p>
        </div>
        <Link
          href="/bulk-change/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Bulk Change
        </Link>
      </div>

      {/* Vertical tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {activeVerticals.map(v => (
          <button
            key={v}
            onClick={() => setTabAndReset(v)}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5">
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
          onChange={e => setFiltersAndReset({ ...filters, search: e.target.value })}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={filters.dept}
          onChange={e => setFiltersAndReset({ ...filters, dept: e.target.value })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Departments</option>
          {depts.map(d => <option key={d}>{d}</option>)}
        </select>
        <select
          value={filters.location}
          onChange={e => setFiltersAndReset({ ...filters, location: e.target.value })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Locations</option>
          {locations.map(l => <option key={l}>{l}</option>)}
        </select>
        {(filters.dept || filters.location || filters.search) && (
          <button
            onClick={() => setFiltersAndReset({ dept: '', location: '', search: '' })}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
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
            ) : paginated.map(e => (
              <tr
                key={e.id}
                onClick={() => setEditing(e)}
                className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
              >
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">{e.name}</p>
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
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} employees
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ←
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | '…')[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-xs text-gray-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`px-3 py-1 text-xs border rounded-md transition-colors ${
                        page === p
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EditPanel
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          depts={depts}
          locations={locations}
          managers={[...new Set(employees.map(e => e.name))].sort()}
        />
      )}
    </div>
  )
}
