'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import StepBar from '@/components/StepBar'
import { EVENT_TEMPLATES, ChangeType, SavedTemplate } from '@/types'
import { useAuth } from '@/lib/auth-context'

type DocState = { name: string; text: string; chars: number } | null
type Route = 'template' | 'manual' | 'ai'

export default function NewBulkChange() {
  const router = useRouter()
  const { persona } = useAuth()

  useEffect(() => {
    if (persona === 'approver') router.replace('/')
  }, [persona, router])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [route, setRoute] = useState<Route | null>(null)
  const [creating, setCreating] = useState(false)

  // Saved templates from Supabase
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([])
  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(d => setSavedTemplates(Array.isArray(d) ? d : []))
  }, [])

  // Template route
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  // Manual route
  const [manualType, setManualType] = useState<ChangeType | null>(null)
  const [manualLabel, setManualLabel] = useState('')

  // AI route
  const [description, setDescription] = useState('')
  const [inferring, setInferring] = useState(false)
  const [inferred, setInferred] = useState<{
    event_type: string; event_label: string; change_type: ChangeType;
    suggested_attrs: string[]; reasoning: string
  } | null>(null)
  const [aiError, setAiError] = useState('')

  // Document state (AI route)
  const [doc, setDoc] = useState<DocState>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [dragging, setDragging] = useState(false)

  const extractDocument = useCallback(async (formData: FormData) => {
    setExtracting(true)
    setExtractError('')
    setDoc(null)
    try {
      const r = await fetch('/api/extract-document', { method: 'POST', body: formData })
      const data = await r.json()
      if (!r.ok || data.error) throw new Error(data.error ?? 'Extraction failed')
      setDoc({ name: data.source, text: data.text, chars: data.text.length })
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : 'Could not extract document')
    } finally {
      setExtracting(false)
    }
  }, [])

  const handleFile = useCallback((file: File) => {
    const allowed = ['application/pdf', 'text/csv', 'text/plain']
    const byExt = file.name.endsWith('.pdf') || file.name.endsWith('.csv') || file.name.endsWith('.txt')
    if (!allowed.includes(file.type) && !byExt) {
      setExtractError('Only PDF, CSV, and TXT files are supported')
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    extractDocument(fd)
  }, [extractDocument])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleInfer = async () => {
    if (!description.trim()) return
    setInferring(true)
    setAiError('')
    setInferred(null)
    try {
      const r = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'infer', description, documentContext: doc?.text ?? null }),
      })
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      setInferred(data)
    } catch (e) {
      setAiError('AI inference failed — try again or choose a template.')
      console.error(e)
    } finally {
      setInferring(false)
    }
  }

  const canContinue =
    (route === 'template' && selectedTemplate !== null) ||
    (route === 'manual' && manualType !== null) ||
    (route === 'ai' && inferred !== null)

  const handleCreate = async () => {
    if (!canContinue) return
    setCreating(true)

    let eventType: string
    let changeType: ChangeType
    let eventDescription: string
    let aiSuggestions: Record<string, unknown> = {}

    if (route === 'template') {
      const saved = savedTemplates.find(t => t.id === selectedTemplate)
      if (saved) {
        eventType = 'custom'
        changeType = saved.change_type
        eventDescription = saved.name
        aiSuggestions = { suggested_attrs: saved.suggested_attrs }
      } else {
        const t = EVENT_TEMPLATES.find(t => t.id === selectedTemplate)!
        eventType = t.id
        changeType = t.changeType
        eventDescription = t.description
      }
    } else if (route === 'manual') {
      eventType = 'custom'
      changeType = manualType!
      eventDescription = manualLabel.trim() || `Custom ${manualType} change`
    } else {
      eventType = inferred!.event_type
      changeType = inferred!.change_type
      eventDescription = description
      aiSuggestions = inferred!
    }

    const r = await fetch('/api/bulk-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, event_description: eventDescription, change_type: changeType, ai_suggestions: aiSuggestions }),
    })
    const data = await r.json()
    if (data.id) router.push(`/bulk-change/${data.id}/scope`)
    else setCreating(false)
  }

  const selectRoute = (r: Route) => {
    setRoute(r)
    setSelectedTemplate(null)
    setManualType(null)
    setManualLabel('')
    setInferred(null)
    setAiError('')
    setDescription('')
    setDoc(null)
    setExtractError('')
  }

  const ROUTES: { id: Route; icon: string; label: string; sub: string }[] = [
    { id: 'template', icon: '📋', label: 'Use a Template', sub: 'Pick from pre-built event scenarios' },
    { id: 'manual',   icon: '⚡', label: 'Quick Start',    sub: 'Define a simple or complex change directly' },
    { id: 'ai',       icon: '✦',  label: 'Describe with AI', sub: 'Describe the situation and let AI classify it' },
  ]

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8"><StepBar current={1} /></div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">What kind of change are you making?</h1>
        <p className="text-gray-500 text-sm mt-1">Choose how you want to set up this bulk change.</p>
      </div>

      {/* Route picker */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {ROUTES.map(r => (
          <button
            key={r.id}
            onClick={() => selectRoute(r.id)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              route === r.id
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className={`text-xl mb-2 ${r.id === 'ai' ? 'text-indigo-500' : ''}`}>{r.icon}</div>
            <p className="font-semibold text-gray-900 text-sm">{r.label}</p>
            <p className="text-gray-400 text-xs mt-0.5">{r.sub}</p>
          </button>
        ))}
      </div>

      {/* ── Route: Template ── */}
      {route === 'template' && (
        <div className="space-y-4 mb-6">
          {savedTemplates.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Saved Templates</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedTemplates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      selectedTemplate === t.id
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-2xl">⭐</span>
                      <span className="font-semibold text-gray-900">{t.name}</span>
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded font-medium ${
                        t.change_type === 'complex' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>{t.change_type}</span>
                    </div>
                    {t.description && <p className="text-gray-500 text-sm pl-9">{t.description}</p>}
                    <p className="text-gray-400 text-xs pl-9 mt-1">{t.suggested_attrs.join(', ')}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            {savedTemplates.length > 0 && (
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Standard Templates</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EVENT_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    selectedTemplate === t.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl">{t.icon}</span>
                    <span className="font-semibold text-gray-900">{t.label}</span>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded font-medium ${
                      t.changeType === 'complex' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>{t.changeType}</span>
                  </div>
                  <p className="text-gray-500 text-sm pl-9">{t.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Route: Manual ── */}
      {route === 'manual' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
          <p className="text-sm font-medium text-gray-700">What type of change is this?</p>
          <div className="grid grid-cols-2 gap-3">
            {(['simple', 'complex'] as ChangeType[]).map(ct => (
              <button
                key={ct}
                onClick={() => setManualType(ct)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  manualType === ct
                    ? ct === 'complex' ? 'border-purple-500 bg-purple-50' : 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`font-semibold text-sm capitalize ${
                  manualType === ct
                    ? ct === 'complex' ? 'text-purple-700' : 'text-indigo-700'
                    : 'text-gray-900'
                }`}>{ct}</p>
                <p className="text-gray-400 text-xs mt-1">
                  {ct === 'simple'
                    ? 'Same value applies to all selected employees'
                    : 'Values differ per employee — review each one'}
                </p>
              </button>
            ))}
          </div>
          {manualType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Change name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                placeholder={`e.g. Q3 ${manualType === 'simple' ? 'Location Update' : 'Compensation Review'}`}
                value={manualLabel}
                onChange={e => setManualLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Route: AI ── */}
      {route === 'ai' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Describe the situation
            <span className="ml-2 text-xs text-gray-400 font-normal">AI will classify and suggest the right flow</span>
          </p>

          <div className="flex gap-3">
            <input
              type="text"
              placeholder="e.g. We are moving the Chicago sales team to the new Austin HQ next month…"
              value={description}
              onChange={e => { setDescription(e.target.value); setInferred(null) }}
              onKeyDown={e => e.key === 'Enter' && handleInfer()}
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              onClick={handleInfer}
              disabled={!description.trim() || inferring}
              className="px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {inferring
                ? <><span className="animate-spin">⟳</span> Inferring…</>
                : <><span>✦</span> Ask AI{doc ? ' + Doc' : ''}</>}
            </button>
          </div>

          {/* Attach file — small CTA */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`transition-colors rounded-lg ${dragging ? 'outline outline-2 outline-indigo-400 bg-indigo-50 p-2' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.txt,text/plain,text/csv,application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {doc ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-green-500">✓</span>
                <span className="font-medium">{doc.name}</span>
                <span className="text-gray-400 text-xs">{doc.chars.toLocaleString()} chars</span>
                <button onClick={() => setDoc(null)} className="text-gray-300 hover:text-red-400 text-lg leading-none ml-1">×</button>
              </div>
            ) : extracting ? (
              <span className="flex items-center gap-1.5 text-xs text-indigo-500">
                <span className="animate-spin">⟳</span> Extracting…
              </span>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span>📎</span> Attach file (PDF, CSV, TXT) or drop here
              </button>
            )}
          </div>

          {extractError && <p className="text-xs text-red-500">{extractError}</p>}
          {aiError && <p className="text-xs text-red-500">{aiError}</p>}

          {inferred && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-indigo-500 text-lg">✦</span>
                <div>
                  <p className="font-semibold text-gray-900">{inferred.event_label}</p>
                  <p className="text-gray-600 text-sm mt-0.5">{inferred.reasoning}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      inferred.change_type === 'complex' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>{inferred.change_type} change</span>
                    <span className="text-xs text-gray-500">Suggested: {inferred.suggested_attrs.join(', ')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary bar */}
      {canContinue && (() => {
        const savedT = route === 'template' ? savedTemplates.find(t => t.id === selectedTemplate) : null
        const hardT  = route === 'template' ? EVENT_TEMPLATES.find(t => t.id === selectedTemplate) : null
        const label  = savedT?.name ?? hardT?.label ?? (route === 'manual' ? (manualLabel.trim() || `Custom ${manualType} change`) : inferred?.event_label)
        const ct     = savedT?.change_type ?? hardT?.changeType ?? (route === 'manual' ? manualType : inferred?.change_type)
        return (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-6">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Selected flow: </span>
              {label}
              {' · '}
              <span className={`font-medium ${ct === 'complex' ? 'text-purple-700' : 'text-indigo-700'}`}>
                {ct} change
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {ct === 'simple'
                ? 'Same value will apply to all selected employees.'
                : 'AI will suggest per-employee values — you can edit each one.'}
            </p>
          </div>
        )
      })()}

      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          disabled={!canContinue || creating}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          {creating ? 'Creating…' : 'Continue → Scope Employees'}
        </button>
      </div>
    </div>
  )
}
