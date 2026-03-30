import './globals.css'
import AppShell from '../components/AppShell'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'

const themeInitScript = `
  (function () {
    try {
      var key = '4e-crm-theme';
      var stored = window.localStorage.getItem(key);
      var theme = stored === 'light' || stored === 'dark'
        ? stored
        : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      var root = document.documentElement;
      root.classList.toggle('theme-light', theme === 'light');
      root.style.colorScheme = theme;
    } catch {}
  })();
`

export const metadata = {
  title: '4 Elements CRM',
  description: 'Internal roofing CRM',
  manifest: '/manifest.webmanifest',
}

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#050505' },
    { media: '(prefers-color-scheme: light)', color: '#f4f6fb' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeInitScript,
          }}
        />
      </head>
      <body>
        <ServiceWorkerRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
