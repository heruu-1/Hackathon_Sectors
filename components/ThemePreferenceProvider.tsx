'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ModePreference = 'beginner' | 'detail'

interface ThemePreferenceContextType {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  mode: ModePreference
  setMode: (mode: ModePreference) => void
}

const ThemePreferenceContext = createContext<ThemePreferenceContextType | null>(null)

function applyThemeToDOM(themePref: ThemePreference) {
  if (typeof window === 'undefined') return

  if (themePref === 'light' || themePref === 'dark') {
    document.documentElement.dataset.rasiTheme = themePref
    document.documentElement.dataset.rasiThemePreference = themePref
  } else {
    // Mode 'system': deteksi prefers-color-scheme OS secara dinamis
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.dataset.rasiTheme = isDark ? 'dark' : 'light'
    document.documentElement.dataset.rasiThemePreference = 'system'
  }
}

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('system')
  const [mode, setModeState] = useState<ModePreference>('beginner')

  useEffect(() => {
    let savedTheme: ThemePreference = 'system'
    try {
      const stored = localStorage.getItem('rasi-theme') as ThemePreference | null
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        savedTheme = stored
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setThemeState(stored)
      }

      const savedMode = localStorage.getItem('rasi-mode') as ModePreference | null
      if (savedMode === 'beginner' || savedMode === 'detail') {
        setModeState(savedMode)
      }
    } catch {
      // Ignore localStorage read errors
    }

    applyThemeToDOM(savedTheme)

    // Listener reaktif jika OS berganti terang/gelap saat mode 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemChange = () => {
      try {
        const current = (localStorage.getItem('rasi-theme') as ThemePreference) || 'system'
        if (current === 'system') {
          applyThemeToDOM('system')
        }
      } catch {
        applyThemeToDOM('system')
      }
    }

    mediaQuery.addEventListener('change', handleSystemChange)
    return () => mediaQuery.removeEventListener('change', handleSystemChange)
  }, [])

  const setTheme = (newTheme: ThemePreference) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem('rasi-theme', newTheme)
    } catch {
      // Ignore localStorage write errors
    }
    applyThemeToDOM(newTheme)
  }

  const setMode = (newMode: ModePreference) => {
    setModeState(newMode)
    try {
      localStorage.setItem('rasi-mode', newMode)
    } catch {
      // Ignore localStorage write errors
    }
  }

  return (
    <ThemePreferenceContext.Provider value={{ theme, setTheme, mode, setMode }}>
      {children}
    </ThemePreferenceContext.Provider>
  )
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext)
  if (!ctx) {
    return {
      theme: 'system' as ThemePreference,
      setTheme: () => {},
      mode: 'beginner' as ModePreference,
      setMode: () => {},
    }
  }
  return ctx
}
