import './globals.css'
import AppShell from '../components/AppShell'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'

export const metadata = {
  title: '4 Elements CRM',
  description: 'Internal roofing CRM',
  manifest: '/manifest.webmanifest',
}

export const viewport = {
  themeColor: '#050505',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
