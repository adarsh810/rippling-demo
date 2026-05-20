'use client'

import { useRouter } from 'next/navigation'
import { useAuth, Persona } from '@/lib/auth-context'

const PERSONAS: {
  id: Persona
  name: string
  role: string
  avatar: string
  description: string
  can: string[]
  cannot: string[]
}[] = [
  {
    id: 'admin',
    name: 'Adarsh Attavar',
    role: 'HR Administrator',
    avatar: 'AA',
    description: 'Create and manage bulk change requests across the organisation.',
    can: ['Create bulk changes', 'Scope employees', 'Define attribute changes', 'Submit for approval', 'Monitor change status'],
    cannot: ['Approve or reject changes'],
  },
  {
    id: 'approver',
    name: 'Jordan Hayes',
    role: 'HR Approver',
    avatar: 'JH',
    description: 'Review and action bulk change requests submitted by administrators.',
    can: ['View pending changes', 'Approve & execute changes', 'Reject with reason', 'Monitor change status'],
    cannot: ['Create or submit new changes'],
  },
]

export default function LoginPage() {
  const router = useRouter()
  const { setPersona } = useAuth()

  const select = (p: Persona) => {
    setPersona(p)
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm font-bold tracking-tight">AV</div>
          <span className="text-xl font-bold text-gray-900">ABC Ventures</span>
        </div>
        <p className="text-gray-400 text-sm">Select a persona to continue</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {PERSONAS.map(p => (
          <button
            key={p.id}
            onClick={() => select(p.id)}
            className="text-left bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-indigo-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                {p.avatar}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-base leading-tight">{p.name}</p>
                <p className="text-indigo-600 text-xs font-medium">{p.role}</p>
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-4 leading-relaxed">{p.description}</p>
            <div className="space-y-1 mb-3">
              {p.can.map(a => (
                <p key={a} className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="text-green-500 font-bold">✓</span> {a}
                </p>
              ))}
            </div>
            {p.cannot.map(a => (
              <p key={a} className="text-xs text-gray-400 flex items-center gap-1.5">
                <span className="text-red-400">✕</span> {a}
              </p>
            ))}
          </button>
        ))}
      </div>
    </div>
  )
}
