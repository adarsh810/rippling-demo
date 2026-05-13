'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StepBar from '@/components/StepBar'
import { EVENT_TEMPLATES, ChangeType } from '@/types'

export default function NewBulkChange() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [inferring, setInferring] = useState(false)
  const [inferred, setInferred] = useState<{
    event_type: string; event_label: string; change_type: ChangeType;
    suggested_attrs: string[]; reasoning: string
  } | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

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
        body: JSON.stringify({ mode: 'infer', description }),
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
    const template = EVENT_TEMPLATES.find(t => t.id === selected)
    const eventType = inferred?.event_type ?? selected
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
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <StepBar current={1} />
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">What real-world event is happening?</h1>
        <p className="text-gray-500 text-sm mt-1">Select a template or describe the situation — AI will route to the right flow.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {EVENT_TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => handleTemplateSelect(t.id)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              selected === t.id && !inferred
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">{t.icon}</span>
              <span className="font-semibold text-gray-900">{t.label}</span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded font-medium ${
                t.changeType === 'complex' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              }`}>{t.changeType}</span>
            </div>
            <p className="text-gray-500 text-sm pl-9">{t.description}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Or describe a new situation
          <span className="ml-2 text-xs text-gray-400 font-normal">AI will classify and route automatically</span>
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="e.g. We are moving the Chicago sales team to the new Austin HQ next month..."
            value={description}
            onChange={e => { setDescription(e.target.value); setSelected(null); setInferred(null) }}
            onKeyDown={e => e.key === 'Enter' && handleInfer()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          <button
            onClick={handleInfer}
            disabled={!description.trim() || inferring}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            {inferring ? (
              <><span className="animate-spin">⟳</span> Inferring...</>
            ) : (
              <><span>✦</span> Ask AI</>
            )}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </div>

      {inferred && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-orange-500 text-lg">✦</span>
            <div>
              <p className="font-semibold text-gray-900">{inferred.event_label}</p>
              <p className="text-gray-600 text-sm mt-0.5">{inferred.reasoning}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  inferred.change_type === 'complex' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
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
            <span className={`font-medium ${(inferred?.change_type ?? activeTemplate?.changeType) === 'complex' ? 'text-purple-700' : 'text-blue-700'}`}>
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
          className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-40 transition-colors"
        >
          {creating ? 'Creating...' : 'Continue → Scope Employees'}
        </button>
      </div>
    </div>
  )
}
