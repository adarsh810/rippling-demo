'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import StepBar from '@/components/StepBar'
import { EVENT_TEMPLATES, ChangeType } from '@/types'

type DocState = { name: string; text: string; chars: number } | null

export default function NewBulkChange() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selected, setSelected]     = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [inferring, setInferring]    = useState(false)
  const [inferred, setInferred]      = useState<{
    event_type: string; event_label: string; change_type: ChangeType;
    suggested_attrs: string[]; reasoning: string
  } | null>(null)
  const [creating, setCreating]      = useState(false)
  const [error, setError]            = useState('')

  // Document state
  const [doc, setDoc]             = useState<DocState>(null)
  const [docUrl, setDocUrl]       = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [dragging, setDragging]   = useState(false)

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
    const byExt   = file.name.endsWith('.pdf') || file.name.endsWith('.csv') || file.name.endsWith('.txt')
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

  const handleFetchUrl = async () => {
    if (!docUrl.trim()) return
    const fd = new FormData()
    fd.append('url', docUrl.trim())
    await extractDocument(fd)
  }

  const handleTemplateSelect = (id: string) => {
    setSelected(id)
    setInferred(null)
    setDescription('')
  }

  const handleInfer = async () => {
    if (!description.trim()) return
    setInferring(true)
    setError('')
    try {
      const r = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'infer', description, documentContext: doc?.text ?? null }),
      })
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      setInferred(data)
      setSelected(data.event_type)
    } catch (e) {
      setError('AI inference failed. Please select a template instead.')
      console.error(e)
    } finally {
      setInferring(false)
    }
  }

  const handleCreate = async () => {
    const template  = EVENT_TEMPLATES.find(t => t.id === selected)
    const eventType  = inferred?.event_type ?? selected
    const changeType = inferred?.change_type ?? template?.changeType ?? 'simple'
    if (!eventType) return

    setCreating(true)
    const r = await fetch('/api/bulk-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: eventType,
        event_description: description || template?.description,
        change_type: changeType,
        ai_suggestions: inferred ?? {},
      }),
    })
    const data = await r.json()
    if (data.id) router.push(`/bulk-change/${data.id}/scope`)
    else setCreating(false)
  }

  const activeTemplate = EVENT_TEMPLATES.find(t => t.id === selected)

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8"><StepBar current={1} /></div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">What real-world event is happening?</h1>
        <p className="text-gray-500 text-sm mt-1">Select a template or describe the situation — AI will route to the right flow.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {EVENT_TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => handleTemplateSelect(t.id)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              selected === t.id && !inferred
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

      {/* Describe + Document upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700">
            Or describe a new situation
            <span className="ml-2 text-xs text-gray-400 font-normal">AI will classify and route automatically</span>
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !extracting && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl px-6 py-5 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.txt,text/plain,text/csv,application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {extracting ? (
            <div className="flex items-center justify-center gap-2 text-indigo-500 text-sm">
              <span className="animate-spin inline-block">⟳</span> Extracting document…
            </div>
          ) : doc ? (
            <div className="flex items-center justify-center gap-3 text-sm">
              <span className="text-green-500">✓</span>
              <span className="font-medium text-gray-800">{doc.name}</span>
              <span className="text-gray-400 text-xs">{doc.chars.toLocaleString()} chars extracted</span>
              <button
                onClick={e => { e.stopPropagation(); setDoc(null); setDocUrl('') }}
                className="ml-1 text-gray-300 hover:text-red-400 text-lg leading-none"
              >×</button>
            </div>
          ) : (
            <div className="text-gray-400 text-sm space-y-1">
              <p className="text-base">📎</p>
              <p>Drop a <span className="font-medium text-gray-600">PDF</span>, <span className="font-medium text-gray-600">CSV</span>, or <span className="font-medium text-gray-600">TXT</span> file here</p>
              <p className="text-xs">or click to browse</p>
            </div>
          )}
        </div>

        {extractError && <p className="text-xs text-red-500">{extractError}</p>}

        {/* Google Docs link */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400 flex-shrink-0">or paste a Google Docs link</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://docs.google.com/document/d/..."
            value={docUrl}
            onChange={e => setDocUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleFetchUrl}
            disabled={!docUrl.trim() || extracting}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap"
          >
            {extracting ? '⟳' : 'Fetch'}
          </button>
        </div>

        {/* Description + Ask AI */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="e.g. We are moving the Chicago sales team to the new Austin HQ next month…"
            value={description}
            onChange={e => { setDescription(e.target.value); setSelected(null); setInferred(null) }}
            onKeyDown={e => e.key === 'Enter' && handleInfer()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={handleInfer}
            disabled={!description.trim() || inferring}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            {inferring ? (
              <><span className="animate-spin">⟳</span> Inferring…</>
            ) : (
              <><span>✦</span> Ask AI{doc ? ' + Doc' : ''}</>
            )}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>

      {inferred && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
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

      {(selected || inferred) && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-6">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Selected flow: </span>
            {inferred ? inferred.event_label : activeTemplate?.label}
            {' · '}
            <span className={`font-medium ${(inferred?.change_type ?? activeTemplate?.changeType) === 'complex' ? 'text-purple-700' : 'text-indigo-700'}`}>
              {inferred?.change_type ?? activeTemplate?.changeType} change
            </span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {(inferred?.change_type ?? activeTemplate?.changeType) === 'simple'
              ? 'Same value will apply to all selected employees.'
              : 'AI will suggest per-employee values — you can edit each one.'}
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          disabled={(!selected && !inferred) || creating}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          {creating ? 'Creating…' : 'Continue → Scope Employees'}
        </button>
      </div>
    </div>
  )
}
