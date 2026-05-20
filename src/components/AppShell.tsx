'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Nav from '@/components/Nav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { persona } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === '/login') return
    if (!persona) router.replace('/login')
  }, [persona, pathname, router])

  // Login page: full-screen, no nav
  if (pathname === '/login') {
    return <main className="flex-1">{children}</main>
  }

  if (!persona) return null

  return (
    <>
      <Nav />
      <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
    </>
  )
}
