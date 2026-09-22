'use client'

import { useThemePreference } from '@/components/ThemePreferenceProvider'

export default function SettingsPage() {
  const { theme, setTheme, mode, setMode } = useThemePreference()

  return (
    <section className="max-w-2xl space-y-8 py-4">
      <div>
        <p className="text-sm font-semibold text-[var(--rasi-primary)]">Pengaturan</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--rasi-text)] sm:text-3xl">
          {' '}
          Atur tampilan RASI{' '}
        </h1>
        <p className="mt-2 text-sm text-[var(--rasi-muted)]">
          {' '}
          Pilih warna tampilan dan seberapa banyak penjelasan yang ingin Anda lihat.{' '}
        </p>
      </div>

      <div className="space-y-4">
        {/* Theme Settings */}
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5">
          <h2 className="font-semibold text-[var(--rasi-text)]"> Warna tampilan </h2>
          <p className="mt-1 text-xs text-[var(--rasi-muted)]">
            {' '}
            Pilih terang, gelap, atau ikuti pengaturan perangkat.{' '}
          </p>
          <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Tema tampilan">
            {(['system', 'light', 'dark'] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setTheme(val)}
                aria-pressed={theme === val}
                className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-bold transition-colors ${
                  theme === val
                    ? 'border-[var(--rasi-primary)] bg-[var(--rasi-primary)] text-[var(--rasi-primary-text)] shadow-md'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--rasi-text)] hover:bg-[var(--rasi-muted-bg)]'
                }`}
              >
                {val === 'system' ? 'Sistem' : val === 'light' ? 'Terang' : 'Gelap'}
              </button>
            ))}
          </div>
        </div>

        {/* Mode Settings: Pemula vs Detail */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-xl shadow-black/40">
          <h2 className="font-semibold text-[var(--rasi-text)]"> Pilihan penjelasan </h2>
          <p className="mt-1 text-xs text-[var(--rasi-muted)]">
            {' '}
            Pilih “Dengan penjelasan” untuk melihat arti istilah, atau “Langsung ke data” jika sudah
            terbiasa.{' '}
          </p>
          <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Mode penjelasan">
            <button
              type="button"
              onClick={() => setMode('beginner')}
              aria-pressed={mode === 'beginner'}
              className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-bold transition-colors ${
                mode === 'beginner'
                  ? 'border-[var(--rasi-primary)] bg-[var(--rasi-primary)] text-[var(--rasi-primary-text)] shadow-md'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--rasi-text)] hover:bg-[var(--rasi-muted-bg)]'
              }`}
            >
              {' '}
              Dengan penjelasan istilah{' '}
            </button>
            <button
              type="button"
              onClick={() => setMode('detail')}
              aria-pressed={mode === 'detail'}
              className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-bold transition-colors ${
                mode === 'detail'
                  ? 'border-[var(--rasi-primary)] bg-[var(--rasi-primary)] text-[var(--rasi-primary-text)] shadow-md'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--rasi-text)] hover:bg-[var(--rasi-muted-bg)]'
              }`}
            >
              {' '}
              Langsung ke data{' '}
            </button>
          </div>
        </div>

        {/* Account Privacy & Security Notice */}
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-5 text-xs leading-relaxed text-[var(--rasi-muted)]">
          <strong className="text-[var(--rasi-text)]"> Data akun Anda: </strong> Daftar pantauan,
          catatan, dan percakapan Anda tersimpan di akun Google yang digunakan untuk masuk. Data
          saham bisa dilihat tanpa masuk. RASI tidak meminta kata sandi akun sekuritas Anda.{' '}
        </div>
      </div>
    </section>
  )
}
