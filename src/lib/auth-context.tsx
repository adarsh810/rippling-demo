'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Persona = 'admin' | 'approver'

interface AuthCtx {
  persona: Persona | null
  setPersona: (p: Persona | null) => void
}

const Ctx = createContext<AuthCtx>({ persona: null, setPersona: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [persona, setPersonaRaw] = useState<Persona | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('rpl_persona')
    if (stored === 'admin' || stored === 'approver') setPersonaRaw(stored)
    setReady(true)
  }, [])

  const setPersona = (p: Persona | null) => {
    setPersonaRaw(p)
    if (p) localStorage.setItem('rpl_persona', p)
    else localStorage.removeItem('rpl_persona')
  }

  if (!ready) return null

  return <Ctx.Provider value={{ persona, setPersona }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
