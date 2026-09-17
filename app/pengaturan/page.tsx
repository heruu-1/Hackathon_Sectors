'use client'

import { useState } from 'react'

import { ResearchShell } from '@/components/ResearchShell'

function applyThemeAttribute(value: string) {
  if (value === 'light' || value === 'dark') document.documentElement.dataset.rasiTheme = value
  else delete document.documentElement.dataset.rasiTheme
}

export default function SettingsPage() {
  const [theme, setTheme] = useState(() =>
    typeof window === 'undefined' ? 'system' : (localStorage.getItem('rasi-theme') ?? 'system'),
  )
  const [beginner, setBeginner] = useState(
    () => typeof window === 'undefined' || localStorage.getItem('rasi-mode') !== 'detail',
  )
  const saveTheme = (value: string) => {
    setTheme(value)
    localStorage.setItem('rasi-theme', value)
    applyThemeAttribute(value)
  }
  return (
    <ResearchShell>
      <section className="max-w-2xl">
        <p className="text-sm font-semibold text-blue-600">Pengaturan</p>
        <h1 className="mt-2 text-3xl font-bold">Atur cara RASI menjelaskan data</h1>
        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5">
            <h2 className="font-semibold">Tema tampilan</h2>
            <p className="mt-1 text-sm text-[var(--rasi-muted)]">
              Tema sistem mengikuti perangkat Anda secara default.
            </p>
            <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Tema tampilan">
              {['system', 'light', 'dark'].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => saveTheme(value)}
                  aria-pressed={theme === value}
                  className={`rounded-lg border px-4 py-2 text-sm ${theme === value ? 'border-blue-600 bg-blue-600 text-white' : 'border-[var(--rasi-border)]'}`}
                >
                  {value === 'system' ? 'Sistem' : value === 'light' ? 'Terang' : 'Gelap'}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5">
            <h2 className="font-semibold">Mode penjelasan</h2>
            <p className="mt-1 text-sm text-[var(--rasi-muted)]">
              Mode pemula selalu menampilkan konteks, tanggal, dan keterbatasan data.
            </p>
            <button
              type="button"
              aria-pressed={beginner}
              onClick={() => {
                const value = !beginner
                setBeginner(value)
                localStorage.setItem('rasi-mode', value ? 'beginner' : 'detail')
              }}
              className={`mt-4 rounded-lg border px-4 py-2 text-sm ${beginner ? 'border-blue-600 bg-blue-600 text-white' : 'border-[var(--rasi-border)]'}`}
            >
              {beginner ? 'Mode pemula aktif' : 'Mode detail aktif'}
            </button>
          </div>
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
            <strong>Privasi:</strong> Login Google dan data pantauan pribadi akan diaktifkan pada
            tahap akun. Jangan masukkan kredensial broker ke RASI.
          </div>
        </div>
      </section>
    </ResearchShell>
  )
}
