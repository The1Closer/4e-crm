import './globals.css'
import AppShell from '../components/AppShell'
import { Geist, Cormorant_Garamond } from 'next/font/google'
import { cn } from '@/lib/utils'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
})

export const metadata = {
  title: '4 Elements CRM',
  description: 'Internal roofing CRM',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={cn('font-sans', geist.variable, cormorant.variable)}
    >
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}