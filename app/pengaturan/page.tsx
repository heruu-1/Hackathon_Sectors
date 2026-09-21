'use client'

import { useThemePreference } from '@/components/ThemePreferenceProvider'

export default function SettingsPage() {
  const { theme, setTheme, mode, setMode } = useThemePreference()

  return (
    <section className="max-w-2xl space-y-8 py-4">
      <div>
        <p className="text-sm font-semibold text-[var(--rasi-primary)]">Pengaturan</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--rasi-text)] sm:text-3xl">
          Atur Cara RASI Menampilkan Data
        </h1>
        <p className="mt-2 text-sm text-[var(--rasi-muted)]">
          Sesuaikan tema visual dan kedalaman penjelasan metrik sesuai tingkat kenyamanan Anda.
        </p>
      </div>

      <div className="space-y-4">
        {/* Theme Settings */}
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5">
          <h2 className="font-semibold text-[var(--rasi-text)]">Tema Tampilan</h2>
          <p className="mt-1 text-xs text-[var(--rasi-muted)]">
            Pilih antara tema terang, gelap, atau mengikuti pengaturan sistem perangkat Anda.
          </p>
          <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Tema tampilan">
            {(['system', 'light', 'dark'] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setTheme(val)}
                aria-pressed={theme === val}
                className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  theme === val
                    ? 'border-[var(--rasi-primary)] bg-[var(--rasi-primary)] text-[var(--rasi-primary-text)] shadow-xs'
                    : 'border-[var(--rasi-border)] bg-[var(--rasi-surface)] text-[var(--rasi-text)] hover:bg-[var(--rasi-muted-bg)]'
                }`}
              >
                {val === 'system' ? 'Sistem' : val === 'light' ? 'Terang' : 'Gelap'}
              </button>
            ))}
          </div>
        </div>

        {/* Mode Settings: Pemula vs Detail */}
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5">
          <h2 className="font-semibold text-[var(--rasi-text)]">Kedalaman Informasi</h2>
          <p className="mt-1 text-xs text-[var(--rasi-muted)]">
            Mode pemula menampilkan ringkasan ramah pemula dan penjelasan istilah, sedangkan mode
            detail membuka seluruh metrik teknis secara lengkap.
          </p>
          <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Mode penjelasan">
            <button
              type="button"
              onClick={() => setMode('beginner')}
              aria-pressed={mode === 'beginner'}
              className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'beginner'
                  ? 'border-[var(--rasi-primary)] bg-[var(--rasi-primary)] text-[var(--rasi-primary-text)] shadow-xs'
                  : 'border-[var(--rasi-border)] bg-[var(--rasi-surface)] text-[var(--rasi-text)] hover:bg-[var(--rasi-muted-bg)]'
              }`}
            >
              Mode Pemula (Ringkasan & Istilah)
            </button>
            <button
              type="button"
              onClick={() => setMode('detail')}
              aria-pressed={mode === 'detail'}
              className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'detail'
                  ? 'border-[var(--rasi-primary)] bg-[var(--rasi-primary)] text-[var(--rasi-primary-text)] shadow-xs'
                  : 'border-[var(--rasi-border)] bg-[var(--rasi-surface)] text-[var(--rasi-text)] hover:bg-[var(--rasi-muted-bg)]'
              }`}
            >
              Mode Detail (Metrik Lengkap)
            </button>
          </div>
        </div>

        {/* Account Privacy & Security Notice */}
        <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]/40 p-5 text-xs leading-relaxed text-[var(--rasi-muted)]">
          <strong className="text-[var(--rasi-text)]">Privasi & Keamanan Akun:</strong> Pantauan
          pribadi, catatan riset, riwayat analisis, dan percakapan AI disimpan secara terisolasi per
          akun Google. Data pasar publik tetap dapat diakses tanpa login. RASI tidak pernah meminta
          kredensial akun sekuritas atau broker Anda.
        </div>
      </div>
    </section>
  )
}
