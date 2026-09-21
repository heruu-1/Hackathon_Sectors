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

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('system')
  const [mode, setModeState] = useState<ModePreference>('beginner')

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('rasi-theme') as ThemePreference | null
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setThemeState(savedTheme)
        if (savedTheme === 'light' || savedTheme === 'dark') {
          document.documentElement.dataset.rasiTheme = savedTheme
        } else {
          delete document.documentElement.dataset.rasiTheme
        }
      }

      const savedMode = localStorage.getItem('rasi-mode') as ModePreference | null
      if (savedMode === 'beginner' || savedMode === 'detail') {
        setModeState(savedMode)
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [])

  const setTheme = (newTheme: ThemePreference) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem('rasi-theme', newTheme)
      if (newTheme === 'light' || newTheme === 'dark') {
        document.documentElement.dataset.rasiTheme = newTheme
      } else {
        delete document.documentElement.dataset.rasiTheme
      }
    } catch {
      // Ignore localStorage write errors
    }
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
