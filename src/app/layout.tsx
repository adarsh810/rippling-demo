import type { Metadata, Viewport } from 'next'
import './globals.css'
import SwRegister from '@/components/SwRegister'
import { AuthProvider } from '@/lib/auth-context'
import AppShell from '@/components/AppShell'

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
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
