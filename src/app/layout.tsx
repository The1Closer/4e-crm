import './globals.css'
import AppShell from '../components/AppShell'

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
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}