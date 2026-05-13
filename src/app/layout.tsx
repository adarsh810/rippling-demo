import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import SwRegister from '@/components/SwRegister'

export const metadata: Metadata = {
  title: 'Rippling · Bulk Change',
  description: 'AI-powered bulk employee attribute updates',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rippling',
  },
}

export const viewport: Viewport = {
  themeColor: '#f97316',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex flex-col md:flex-row bg-gray-50 antialiased">
        <SwRegister />
        <Nav />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
      </body>
    </html>
  )
}
