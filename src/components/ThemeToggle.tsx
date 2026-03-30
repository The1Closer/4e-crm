'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

type AppTheme = 'dark' | 'light'

const THEME_STORAGE_KEY = '4e-crm-theme'

function getSystemTheme(): AppTheme {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

function resolveInitialTheme(): AppTheme {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return getSystemTheme()
}

function applyTheme(theme: AppTheme) {
  const root = document.documentElement

  root.classList.toggle('theme-light', theme === 'light')
  root.style.colorScheme = theme
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<AppTheme>(() => resolveInitialTheme())

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const isLightTheme = theme === 'light'

  return (
    <button
      suppressHydrationWarning
      type="button"
      onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      className="crm-glass crm-glass-hover inline-flex h-10 w-10 items-center justify-center rounded-[1rem] text-[var(--shell-text-muted)] transition hover:text-[var(--shell-text)] sm:h-12 sm:w-12 sm:rounded-[1.35rem]"
      aria-label={`Switch to ${isLightTheme ? 'dark' : 'light'} mode`}
      title={isLightTheme ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {isLightTheme ? (
        <Moon className="h-4 w-4 text-[#d6b37a]" />
      ) : (
        <Sun className="h-4 w-4 text-[#d6b37a]" />
      )}
      <span className="sr-only">{`Current theme ${theme}. Activate to switch themes.`}</span>
    </button>
  )
}
