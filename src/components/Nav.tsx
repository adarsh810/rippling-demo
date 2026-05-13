'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const links = [
  { href: '/',                  label: 'Dashboard',      icon: '⊞' },
  { href: '/bulk-change/new',   label: 'New Change',     icon: '+' },
  { href: '/employees',         label: 'Employees',      icon: '👤' },
  { href: '/audit',             label: 'Audit',          icon: '☰' },
]

export default function Nav() {
  const path = usePathname()

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-orange-500 flex items-center justify-center text-white text-xs font-bold">R</div>
            <span className="text-gray-900 font-semibold text-sm">Rippling</span>
          </div>
          <p className="text-gray-400 text-xs mt-1 ml-9">Bulk Change</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                path === l.href
                  ? 'bg-orange-50 text-orange-600 font-medium'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <span className="text-base w-4 text-center">{l.icon}</span>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-gray-700 text-xs font-medium">Adarsh Attavar</p>
          <p className="text-gray-400 text-xs">HR Admin</p>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-7 h-7 rounded-md bg-orange-500 flex items-center justify-center text-white text-xs font-bold">R</div>
        <span className="text-gray-900 font-semibold text-sm">Rippling · Bulk Change</span>
      </header>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex z-50">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
              path === l.href
                ? 'text-orange-500 font-medium'
                : 'text-gray-400'
            )}
          >
            <span className="text-lg leading-none">{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
