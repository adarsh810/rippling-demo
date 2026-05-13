'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const links = [
  { href: '/', label: 'Dashboard', icon: '⊞' },
  { href: '/bulk-change/new', label: 'New Bulk Change', icon: '+' },
  { href: '/employees', label: 'Employees', icon: '👤' },
  { href: '/audit', label: 'Audit Trail', icon: '☰' },
]

export default function Nav() {
  const path = usePathname()
  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
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
  )
}
