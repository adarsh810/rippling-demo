'use client'

import { useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import StepBar from '@/components/StepBar'
import { Employee, BulkChange, EVENT_TEMPLATES, VERTICAL_ATTRS } from '@/types'
import { supabase } from '@/lib/supabase'

interface ChangeRow {
  employee_id: string
  employee_name: string
  employee_title: string
  attribute: string
  old_value: string
  new_value: string
  reasoning?: string
}

interface SimpleRule {
  attribute: string
  new_value: string
}

const BASE_ATTRS = ['compensation', 'title', 'department', 'location', 'manager']
const NUMERIC_ATTRS = new Set(['compensation', 'hourly_rate', 'bill_rate', 'equity_grant', 'pto_days', 'bonus_target'])
const SHIFT_TYPES = ['morning', 'afternoon', 'evening', 'night']
const AGENCIES = ['TechStaff Solutions', 'Apex Consulting', 'Talent Bridge', 'Prime Resources', 'NextGen Staffing', 'Catalyst Group', 'Summit Professionals']
const ATTR_PLACEHOLDER: Record<string, string> = { compensation: 'e.g. 145000', title: 'e.g. Senior Engineer' }
const SELECT_CLS = 'w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500'

function attrLabel(key: string): string {
  for (const attrs of Object.values(VERTICAL_ATTRS)) {
    const found = attrs.find(a => a.key === key)
    if (found) return found.label
  }
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function validAttrsForEmployee(emp: Employee): Set<string> {
  return new Set([...BASE_ATTRS, ...(VERTICAL_ATTRS[emp.vertical] ?? []).map(a => a.key)])
}

function verticalLabel(v: string) {
  return v === 'full_time' ? 'FT' : v === 'hourly' ? 'HR' : 'CT'
}
function verticalCls(v: string) {
  return v === 'full_time' ? 'bg-blue-100 text-blue-600' : v === 'hourly' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
}

function displayValue(attr: string, val: string) {
  if (!val) return '—'
  if (attr === 'compensation') return `$${parseFloat(val).toLocaleString()}`
  if (attr === 'overtime_eligible') return val === 'true' ? 'Yes' : 'No'
  return val
}

function ValueInput({ attr, value, onChange, depts, locations, managers, compact = true }: {
  attr: string; value: string; onChange: (v: string) => void
  depts: string[]; locations: string[]; managers: string[]; compact?: boolean
}) {
  const cls = compact ? SELECT_CLS : 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  if (attr === 'department') return <select value={value} onChange={e => onChange(e.target.value)} className={cls}><option value="">— select —</option>{depts.map(d => <option key={d}>{d}</option>)}</select>
  if (attr === 'location') return <select value={value} onChange={e => onChange(e.target.value)} className={cls}><option value="">— select —</option>{locations.map(l => <option key={l}>{l}</option>)}</select>
  if (attr === 'shift_type') return <select value={value} onChange={e => onChange(e.target.value)} className={cls}><option value="">— select —</option>{SHIFT_TYPES.map(s => <option key={s}>{s}</option>)}</select>
  if (attr === 'overtime_eligible') return <select value={value} onChange={e => onChange(e.target.value)} className={cls}><option value="">— select —</option><option value="true">Yes</option><option value="false">No</option></select>
  if (attr === 'manager') return <><input list="mgr-list" value={value} onChange={e => onChange(e.target.value)} placeholder="Type or select" className={cls} /><datalist id="mgr-list">{managers.map(m => <option key={m} value={m} />)}</datalist></>
  if (attr === 'agency_name') return <><input list="agency-list" value={value} onChange={e => onChange(e.target.value)} placeholder="Type or select" className={cls} /><datalist id="agency-list">{AGENCIES.map(a => <option key={a} value={a} />)}</datalist></>
  if (attr === 'contract_end_date') return <input type="date" value={value} onChange={e => onChange(e.target.value)} className={cls} />
  if (NUMERIC_ATTRS.has(attr)) return <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={ATTR_PLACEHOLDER[attr] ?? ''} className={cls} />
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={ATTR_PLACEHOLDER[attr] ?? ''} className={cls} />
}

// Build all rows for (employees × attrs), overlay AI suggestions on top
function buildRows(employees: Employee[], selectedAttrs: string[], suggestions?: { employee_name: string; attribute: string; new_value: string; reasoning?: string }[]): ChangeRow[] {
  const rows: ChangeRow[] = []
  for (const emp of employees) {
    const valid = validAttrsForEmployee(emp)
    for (const attr of selectedAttrs) {
      if (!valid.has(attr)) continue
      rows.push({
        employee_id: emp.id, employee_name: emp.name, employee_title: emp.title,
        attribute: attr,
        old_value: String((emp as unknown as Record<string, unknown>)[attr] ?? ''),
        new_value: '',
      })
    }
  }
  if (suggestions) {
    for (const s of suggestions) {
      const idx = rows.findIndex(r => r.employee_name === s.employee_name && r.attribute === s.attribute)
      if (idx >= 0) { rows[idx].new_value = String(s.new_value); rows[idx].reasoning = s.reasoning }
    }
  }
  return rows
}

export default function ChangesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const employeeIds = searchParams.get('employees')?.split(',') ?? []

  const [change, setChange] = useState<BulkChange | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [rows, setRows] = useState<ChangeRow[]>([])
  const [saving, setSaving] = useState(false)

  // Simple flow
  const [rules, setRules] = useState<SimpleRule[]>([])

  // Complex flow
  const [phase, setPhase] = useState<'describe' | 'review'>('describe')
  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([])
  const [activeAttr, setActiveAttr] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [aiUsed, setAiUsed] = useState(false)
  const [error, setError] = useState('')

  // Keep activeAttr pointing at a valid tab
  useEffect(() => {
    if (phase !== 'review') return
    if (!activeAttr || !selectedAttrs.includes(activeAttr)) {
      setActiveAttr(selectedAttrs[0] ?? null)
    }
  }, [selectedAttrs, phase, activeAttr])

  useEffect(() => {
    supabase.from('rpl_bulk_changes').select('*').eq('id', id).single()
      .then(({ data }) => {
        setChange(data)
        const aiSuggested = (data.ai_suggestions as Record<string, unknown>)?.suggested_attrs
        const aiAttrs = Array.isArray(aiSuggested) && aiSuggested.length > 0 ? aiSuggested as string[] : null
        const tmpl = EVENT_TEMPLATES.find(t => t.id === data.event_type)
        if (data?.change_type === 'simple') {
          const attrs = aiAttrs ?? (tmpl?.suggestedAttrs?.length ? tmpl.suggestedAttrs : ['location'])
          setRules(attrs.map(a => ({ attribute: a, new_value: '' })))
        } else {
          setSelectedAttrs(aiAttrs ?? tmpl?.suggestedAttrs ?? [])
        }
      })
    supabase.from('rpl_employees').select('*').order('name')
      .then(({ data }) => setAllEmployees(data ?? []))
    if (employeeIds.length > 0) {
      supabase.from('rpl_employees').select('*').in('id', employeeIds)
        .then(({ data }) => setEmployees(data ?? []))
    }
  }, [id])

  // ── Simple helpers ───────────────────────────────────────────────────
  const addRule = () => {
    const used = new Set(rules.map(r => r.attribute))
    const next = ATTRS.find(a => !used.has(a)) ?? ATTRS[0]
    setRules(prev => [...prev, { attribute: next, new_value: '' }])
  }
  const updateRule = (i: number, field: keyof SimpleRule, value: string) =>
    setRules(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  const removeRule = (i: number) => setRules(prev => prev.filter((_, idx) => idx !== i))
  const applyRules = () => {
    const valid = rules.filter(r => r.new_value.trim())
    if (!valid.length) return
    setRows(employees.flatMap(emp => valid.map(rule => ({
      employee_id: emp.id, employee_name: emp.name, employee_title: emp.title,
      attribute: rule.attribute,
      old_value: String((emp as unknown as Record<string, unknown>)[rule.attribute] ?? ''),
      new_value: rule.new_value.trim(),
    }))))
  }

  // ── Complex helpers ──────────────────────────────────────────────────
  const handleDescribeContinue = async () => {
    if (!change || employees.length === 0 || selectedAttrs.length === 0) return
    setError('')

    if (description.trim()) {
      setSuggesting(true)
      try {
        const r = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'suggest', eventType: change.event_type, changeType: change.change_type,
            description: description.trim(), targetAttrs: selectedAttrs,
            employees: employees.map(e => ({
              name: e.name, department: e.department, title: e.title,
              location: e.location, compensation: e.compensation, vertical: e.vertical,
              hourly_rate: e.hourly_rate, overtime_eligible: e.overtime_eligible, shift_type: e.shift_type,
              equity_grant: e.equity_grant, bonus_target: e.bonus_target, pto_days: e.pto_days,
              bill_rate: e.bill_rate, agency_name: e.agency_name, contract_end_date: e.contract_end_date,
            })),
          }),
        })
        const suggestions = await r.json()
        if (!Array.isArray(suggestions)) throw new Error('Unexpected response')
        setRows(buildRows(employees, selectedAttrs, suggestions))
        setAiUsed(true)
      } catch (e) {
        console.error(e)
        setError('AI generation failed — proceeding with blank values. Fill them in manually.')
        setRows(buildRows(employees, selectedAttrs))
        setAiUsed(false)
      } finally {
        setSuggesting(false)
      }
    } else {
      setRows(buildRows(employees, selectedAttrs))
      setAiUsed(false)
    }

    setActiveAttr(selectedAttrs[0] ?? null)
    setPhase('review')
  }

  const updateRowByKey = (empId: string, attr: string, value: string) =>
    setRows(prev => prev.map(r => r.employee_id === empId && r.attribute === attr ? { ...r, new_value: value } : r))

  const handleAddAttrOnReview = (attr: string) => {
    if (!attr || selectedAttrs.includes(attr)) return
    setSelectedAttrs(prev => [...prev, attr])
    setRows(prev => [
      ...prev,
      ...employees
        .filter(emp => validAttrsForEmployee(emp).has(attr))
        .map(emp => ({
          employee_id: emp.id, employee_name: emp.name, employee_title: emp.title,
          attribute: attr,
          old_value: String((emp as unknown as Record<string, unknown>)[attr] ?? ''),
          new_value: '',
        })),
    ])
    setActiveAttr(attr)
  }

  const handleRemoveAttrOnReview = (attr: string) => {
    setSelectedAttrs(prev => {
      const next = prev.filter(a => a !== attr)
      if (activeAttr === attr) setActiveAttr(next[0] ?? null)
      return next
    })
    setRows(prev => prev.filter(r => r.attribute !== attr))
  }

  // ── Save ─────────────────────────────────────────────────────────────
  const handleContinue = async () => {
    const toSave = rows.filter(r => r.new_value.trim())
    if (!toSave.length) return
    setSaving(true)
    await fetch('/api/bulk-change/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulk_change_id: id, items: toSave }),
    })
    const systemMap: Record<string, string[]> = {
      compensation: ['Payroll', 'Benefits', 'Tax Engine'],
      location: ['Payroll', 'Benefits', 'Slack'],
      department: ['Slack', 'GitHub', 'Device Mgmt'],
      title: ['Org Chart', 'Slack'],
      manager: ['Org Chart', 'Slack'],
    }
    const systems = [...new Set(toSave.flatMap(r => systemMap[r.attribute] ?? []))]
    await fetch('/api/bulk-change', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, affected_systems: systems }),
    })
    router.push(`/bulk-change/${id}/preview`)
  }

  // ── Derived ──────────────────────────────────────────────────────────
  const template = EVENT_TEMPLATES.find(t => t.id === change?.event_type)
  const isSimple = change?.change_type === 'simple'
  const validRules = rules.filter(r => r.new_value.trim())
  const usedAttrs = new Set(rules.map(r => r.attribute))
  const scopedVerticals = [...new Set(employees.map(e => e.vertical))]
  const verticalAttrs = isSimple
    ? (scopedVerticals.length === 1 ? (VERTICAL_ATTRS[scopedVerticals[0]] ?? []).map(a => a.key) : [])
    : scopedVerticals.flatMap(v => (VERTICAL_ATTRS[v] ?? []).map(a => a.key))
  const ATTRS = [...new Set([...BASE_ATTRS, ...verticalAttrs])]
  const hasMixedVerticals = isSimple && scopedVerticals.length > 1 &&
    scopedVerticals.some(v => (VERTICAL_ATTRS[v] ?? []).length > 0)
  const depts = [...new Set(allEmployees.map(e => e.department))].sort()
  const locations = [...new Set(allEmployees.map(e => e.location))].sort()
  const managers = [...new Set(allEmployees.map(e => e.name))].sort()

  // Simple flow: grouped for header badges
  const attrGroups = rows.reduce<Record<string, ChangeRow[]>>((acc, r) => {
    acc[r.attribute] = [...(acc[r.attribute] ?? []), r]; return acc
  }, {})

  // Complex review: employees who don't appear in any tab (no valid attr)
  const employeeIdsWithRows = new Set(rows.map(r => r.employee_id))
  const employeesWithNoAttrs = !isSimple && phase === 'review'
    ? employees.filter(e => !employeeIdsWithRows.has(e.id))
    : []

  // For active tab: all rows for that attr + completion stats per tab
  const tabStats = (attr: string) => {
    const attrRows = rows.filter(r => r.attribute === attr)
    const filled = attrRows.filter(r => r.new_value.trim()).length
    return { total: attrRows.length, filled }
  }
  const filledTotal = rows.filter(r => r.new_value.trim()).length

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8"><StepBar current={3} /></div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isSimple ? 'Define Uniform Changes' : phase === 'describe' ? 'Describe the Change' : 'Review Changes'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {employees.length} employees · {change?.change_type} change
            {template && <> · {template.icon} {template.label}</>}
          </p>
        </div>
        {!isSimple && phase === 'review' && (
          <div className="flex items-center gap-3">
            {aiUsed && <span className="text-xs text-indigo-600 flex items-center gap-1"><span>✦</span> AI suggested</span>}
            <button
              onClick={() => { setPhase('describe'); setRows([]); setAiUsed(false); setError('') }}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >← Re-describe</button>
          </div>
        )}
      </div>

      {/* ── SIMPLE FLOW ── */}
      {isSimple && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Apply uniform values to all {employees.length} employees</h2>
              <p className="text-gray-400 text-xs mt-0.5">Add one or more attributes — each value applies to every scoped employee</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={addRule}
                disabled={rules.length >= ATTRS.length}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >+ Add attribute</button>
              {hasMixedVerticals && (
                <p className="text-xs text-indigo-400">
                  Showing attrs common to all scoped employment types ({scopedVerticals.map(v => v.replace('_', ' ')).join(', ')})
                </p>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {rules.map((rule, i) => (
              <div key={i} className="flex gap-3 items-end">
                <div className="w-44 flex-shrink-0">
                  {i === 0 && <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">Attribute</label>}
                  <select
                    value={rule.attribute}
                    onChange={e => updateRule(i, 'attribute', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ATTRS.map(a => <option key={a} value={a} disabled={usedAttrs.has(a) && a !== rule.attribute}>{a}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  {i === 0 && <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">New Value (applied to all)</label>}
                  <ValueInput attr={rule.attribute} value={rule.new_value} onChange={v => updateRule(i, 'new_value', v)} depts={depts} locations={locations} managers={managers} compact={false} />
                </div>
                {rules.length > 1 && (
                  <button onClick={() => removeRule(i)} className="px-2 py-2 text-gray-300 hover:text-red-400 text-xl leading-none">×</button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {validRules.length === 0
                ? 'Fill in at least one value to apply'
                : `${validRules.length} attribute${validRules.length > 1 ? 's' : ''} × ${employees.length} employees = ${validRules.length * employees.length} changes`}
            </p>
            <button onClick={applyRules} disabled={validRules.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40">
              Apply to All Employees
            </button>
          </div>
        </div>
      )}

      {/* ── COMPLEX PHASE 1: DESCRIBE ── */}
      {!isSimple && phase === 'describe' && (() => {
        const verticalBadge = scopedVerticals.length === 1
          ? { label: scopedVerticals[0].replace('_', ' '), cls: scopedVerticals[0] === 'hourly' ? 'bg-yellow-100 text-yellow-700' : scopedVerticals[0] === 'contractor' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700' }
          : { label: 'all employment types', cls: 'bg-indigo-100 text-indigo-700' }
        const availableToAdd = ATTRS.filter(a => !selectedAttrs.includes(a))
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-sm font-semibold text-gray-900">Attributes in scope</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${verticalBadge.cls}`}>{verticalBadge.label}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedAttrs.map(attr => (
                  <span key={attr} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium rounded-full">
                    {attrLabel(attr)}
                    <button onClick={() => setSelectedAttrs(prev => prev.filter(a => a !== attr))} className="text-indigo-300 hover:text-indigo-600 leading-none text-base">×</button>
                  </span>
                ))}
                {selectedAttrs.length === 0 && <span className="text-xs text-gray-400 italic">No attributes selected — add one below</span>}
                {availableToAdd.length > 0 && (
                  <select value="" onChange={e => { if (e.target.value) setSelectedAttrs(prev => [...prev, e.target.value]) }}
                    className="text-xs px-2 py-1 border border-dashed border-gray-300 rounded-full text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer hover:border-gray-400">
                    <option value="">+ Add attribute</option>
                    {availableToAdd.map(a => <option key={a} value={a}>{attrLabel(a)}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 flex-shrink-0">optionally describe the change for more precise suggestions</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <textarea
              rows={4}
              placeholder={
                change?.event_type === 'perf_cycle' ? "e.g. Top performers get 12% comp increase and promotion. Mid-performers get 6%." :
                change?.event_type === 'reorg' ? "e.g. Move Sales engineers to Solutions Engineering under Nina Kowalski." :
                change?.event_type === 'schedule_restructure' ? "e.g. Move morning shift workers to evening. Increase overtime eligibility for leads." :
                "Optional — describe criteria, amounts, or per-employee notes."
              }
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-gray-800 placeholder-gray-300"
            />
            <div className="flex flex-wrap gap-2">
              {employees.slice(0, 5).map(e => (
                <span key={e.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{e.name} · {e.title}</span>
              ))}
              {employees.length > 5 && <span className="text-xs text-gray-400 px-2 py-1">+{employees.length - 5} more</span>}
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {selectedAttrs.length === 0 ? 'Select at least one attribute to continue' :
                  description.trim()
                    ? `${selectedAttrs.length} attr${selectedAttrs.length !== 1 ? 's' : ''} · ${employees.length} employees · Claude will suggest values`
                    : `${selectedAttrs.length} attr${selectedAttrs.length !== 1 ? 's' : ''} · ${employees.length} employees · you'll fill values manually`}
              </p>
              <button
                onClick={handleDescribeContinue}
                disabled={selectedAttrs.length === 0 || suggesting || employees.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                {suggesting ? <><span className="animate-spin inline-block">⟳</span> Generating…</> : 'Preview Changes →'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── COMPLEX PHASE 2: REVIEW ── */}
      {!isSimple && phase === 'review' && (() => {
        const availableToAdd = ATTRS.filter(a => !selectedAttrs.includes(a))
        const activeRows = rows.filter(r => r.attribute === activeAttr)
        const activeEmployees = employees.filter(e => activeRows.some(r => r.employee_id === e.id))

        return (
          <>
            {/* AI error callout */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-4 text-xs text-red-600">{error}</div>
            )}

            {/* Employees-with-no-attrs callout */}
            {employeesWithNoAttrs.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-4 text-xs text-amber-700">
                {employeesWithNoAttrs.length} employee{employeesWithNoAttrs.length !== 1 ? 's' : ''} {employeesWithNoAttrs.length === 1 ? 'has' : 'have'} no valid attributes selected and will be skipped.
              </div>
            )}

            {/* Tab bar */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="flex items-center border-b border-gray-100 overflow-x-auto">
                {selectedAttrs.map(attr => {
                  const { total, filled } = tabStats(attr)
                  const complete = total > 0 && filled === total
                  const partial = filled > 0 && !complete
                  const isActive = attr === activeAttr
                  return (
                    <button
                      key={attr}
                      onClick={() => setActiveAttr(attr)}
                      className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                        isActive ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      <span>{attrLabel(attr)}</span>
                      {complete
                        ? <span className="text-green-500 text-xs font-bold">✓</span>
                        : partial
                          ? <span className="text-xs text-amber-500 font-medium">{filled}/{total}</span>
                          : total > 0
                            ? <span className="text-xs text-gray-300">{total}</span>
                            : null}
                      <button
                        onClick={e => { e.stopPropagation(); handleRemoveAttrOnReview(attr) }}
                        className="text-gray-300 hover:text-red-400 leading-none ml-0.5 text-base transition-colors"
                        title="Remove attribute"
                      >×</button>
                    </button>
                  )
                })}
                {/* Add attribute inline */}
                {availableToAdd.length > 0 && (
                  <div className="px-3 py-3 flex-shrink-0">
                    <select
                      value=""
                      onChange={e => { if (e.target.value) handleAddAttrOnReview(e.target.value) }}
                      className="text-xs px-2 py-1 border border-dashed border-gray-300 rounded-full text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer hover:border-gray-400"
                    >
                      <option value="">+ Add</option>
                      {availableToAdd.map(a => {
                        const vertical = Object.entries(VERTICAL_ATTRS).find(([, attrs]) => attrs.some(x => x.key === a))?.[0]
                        return <option key={a} value={a}>{attrLabel(a)}{vertical ? ` (${vertical.replace('_', ' ')})` : ''}</option>
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Active tab content */}
              {activeAttr && activeEmployees.length > 0 ? (
                <>
                  <div className="grid grid-cols-[1fr_140px_200px] gap-0 border-b border-gray-50">
                    <div className="px-5 py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wide">Employee</div>
                    <div className="px-4 py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wide">Current</div>
                    <div className="px-4 py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                      New Value {aiUsed && <span className="text-indigo-400 normal-case font-normal">· ✦ AI suggested</span>}
                    </div>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {activeEmployees.map(emp => {
                      const row = activeRows.find(r => r.employee_id === emp.id)!
                      const filled = row.new_value.trim().length > 0
                      return (
                        <div
                          key={emp.id}
                          className={`grid grid-cols-[1fr_140px_200px] gap-0 items-start transition-colors ${filled ? 'bg-green-50/30' : 'hover:bg-gray-50/60'}`}
                        >
                          <div className="px-5 py-3.5 flex items-center gap-2.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${verticalCls(emp.vertical)}`}>
                              {verticalLabel(emp.vertical)}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-gray-900 leading-tight">{emp.name}</p>
                              <p className="text-xs text-gray-400 leading-tight mt-0.5">{emp.title}</p>
                            </div>
                          </div>
                          <div className="px-4 py-3.5 text-sm text-gray-400 self-center">
                            {displayValue(activeAttr, row.old_value)}
                          </div>
                          <div className="px-4 py-3 self-center">
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <ValueInput
                                  attr={activeAttr}
                                  value={row.new_value}
                                  onChange={v => updateRowByKey(emp.id, activeAttr, v)}
                                  depts={depts} locations={locations} managers={managers}
                                />
                              </div>
                              {filled
                                ? <span className="text-green-500 text-sm w-4 flex-shrink-0">✓</span>
                                : <span className="w-4 flex-shrink-0" />}
                            </div>
                            {aiUsed && row.reasoning && (
                              <p className="text-[11px] text-gray-400 italic mt-1 leading-tight">{row.reasoning}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Tab footer */}
                  <div className="px-5 py-3 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                    <span>{tabStats(activeAttr).filled} of {tabStats(activeAttr).total} filled</span>
                    {description && <span className="text-gray-400 italic truncate max-w-xs">{description}</span>}
                  </div>
                </>
              ) : activeAttr ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">
                  No employees in scope have the <span className="font-medium">{attrLabel(activeAttr)}</span> attribute.
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-sm text-gray-400">Select a tab above.</div>
              )}
            </div>
          </>
        )
      })()}

      {/* Simple flow: staged changes table */}
      {isSimple && rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
            <p className="text-sm font-medium text-gray-700">{rows.length} change{rows.length !== 1 ? 's' : ''} staged</p>
            {Object.keys(attrGroups).map(attr => (
              <span key={attr} className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">
                {attr} → {attrGroups[attr][0].new_value}
              </span>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Employee', 'Attribute', 'Current', 'New Value'].map(h => (
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
                  <td className="px-5 py-3 text-gray-600 text-xs">{attrLabel(r.attribute)}</td>
                  <td className="px-5 py-3 text-gray-400">{displayValue(r.attribute, r.old_value)}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{displayValue(r.attribute, r.new_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={() => router.push(`/bulk-change/${id}/scope`)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">← Back</button>
        {(!isSimple ? phase === 'review' : true) && (
          <div className="flex items-center gap-3">
            {!isSimple && phase === 'review' && (
              <span className="text-xs text-gray-400">
                {filledTotal} change{filledTotal !== 1 ? 's' : ''} filled
              </span>
            )}
            <button
              onClick={handleContinue}
              disabled={(isSimple ? rows.length === 0 : filledTotal === 0) || saving}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving…' : 'Preview Changes →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
