'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { ArrowDownRight, ArrowUpRight, Bookmark, Bot, Info, Loader2, RefreshCw } from 'lucide-react'

import { addToWatchlist, analyzeTicker, deleteWatchlistItem, getWatchlist } from '@/app/actions'
import type { Anomaly } from '@/db/schema'
import type { BandarmologyAnalysis } from '@/lib/bandarmology'
import type { CatalystDivergence } from '@/lib/divergence'
import type { InsiderMovementAnalysis } from '@/lib/insider'

function metricHelp(label: string) {
  const values: Record<string, string> = {
    'Indikator perhatian':
      'Gabungan beberapa sinyal data yang perlu diperiksa. Ini bukan probabilitas untung atau rekomendasi transaksi.',
    'Volume spike':
      'Perbandingan volume terbaru dengan rata-rata volume hari sebelumnya pada rentang yang tersedia.',
    'P/E':
      'Harga saham dibandingkan laba per saham pada periode yang ditampilkan. Selalu periksa tahun dan sektor.',
    'P/B':
      'Harga saham dibandingkan nilai buku. Angka ini tidak bermakna tanpa konteks model bisnis dan periode.',
  }
  return values[label] ?? 'Data ini perlu dibaca bersama tanggal, sumber, dan metrik lain.'
}

export default function StockDetail({ ticker }: { ticker: string }) {
  const symbol = ticker.trim().toUpperCase().replace(/\.JK$/, '')
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = ['summary', 'fundamental', 'broker', 'news', 'insider'].includes(
    searchParams.get('tab') ?? '',
  )
    ? (searchParams.get('tab') as 'summary' | 'fundamental' | 'broker' | 'news' | 'insider')
    : 'summary'
  const [data, setData] = useState<Anomaly | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [savedId, setSavedId] = useState<number | null>(null)
  const broker = data?.bandarmology as BandarmologyAnalysis | null
  const catalyst = data?.catalystDivergence as CatalystDivergence | null
  const insider = data?.insiderMovement as InsiderMovementAnalysis | null

  const run = async () => {
    setLoading(true)
    setError('')
    const result = await analyzeTicker(symbol)
    if (result.error) setError(result.error)
    if (result.data) setData(result.data)
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void run(), 0)
    return () => window.clearTimeout(timer)
    // This page intentionally analyses only after navigation to a symbol.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getWatchlist().then((result) => {
        const item = result.data?.find((entry) => entry.ticker === symbol)
        setSaved(Boolean(item))
        setSavedId(item?.id ?? null)
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [symbol])

  const toggleSaved = async () => {
    if (savedId) {
      const result = await deleteWatchlistItem(savedId)
      if (!result.success) {
        setError(result.error || 'Pantauan belum dapat dihapus.')
        return
      }
      setSaved(false)
      setSavedId(null)
      return
    }
    const result = await addToWatchlist({
      ticker: symbol,
      name: data?.name || symbol,
      lastPrice: data?.price || undefined,
      lastChange: data?.change || undefined,
    })
    if (!result.success || !result.data) {
      setError(result.error || 'Masuk dengan Google untuk menyimpan pantauan.')
      return
    }
    setSaved(true)
    setSavedId(result.data.id)
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/saham" className="text-sm font-semibold text-blue-600 hover:underline">
            ← Kembali ke pencarian
          </Link>
          <h1 className="mt-3 font-mono text-4xl font-bold tracking-tight">{symbol}</h1>
          <p className="mt-1 text-sm text-[var(--rasi-muted)]">
            Snapshot analisis dari Sectors dan mesin indikator RASI.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void toggleSaved()}
            className={`rasi-button-secondary ${saved ? 'border-emerald-500 text-emerald-700' : ''}`}
          >
            <Bookmark className="h-4 w-4" />
            {saved ? 'Tersimpan di akun' : 'Simpan pantauan'}
          </button>
          <Link href={`/bandingkan?symbols=${symbol}`} className="rasi-button-secondary">
            Bandingkan
          </Link>
          <Link href={`/asisten?symbol=${symbol}`} className="rasi-button-primary">
            <Bot className="h-4 w-4" /> Tanya AI
          </Link>
        </div>
      </div>
      {loading && (
        <div
          className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-6"
          role="status"
        >
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Mengambil data yang tersedia…
        </div>
      )}
      {error && (
        <div
          className="rounded-xl border border-rose-300 bg-rose-50 p-5 text-sm text-rose-800"
          role="alert"
        >
          <p>{error}</p>
          {error.startsWith('AUTH_REQUIRED') && (
            <Link href="/masuk" className="mt-2 inline-block font-semibold underline">
              Masuk dengan Google untuk menyimpan pantauan
            </Link>
          )}
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 font-semibold underline"
            onClick={() => void run()}
          >
            <RefreshCw className="h-4 w-4" /> Coba lagi
          </button>
        </div>
      )}
      {!loading && !error && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Harga penutupan"
              value={data.price}
              help="Harga penutupan terakhir yang dikembalikan sumber."
            />
            <Metric
              label="Perubahan harian"
              value={data.change}
              trend={
                data.change.startsWith('-')
                  ? 'down'
                  : data.change.startsWith('+')
                    ? 'up'
                    : undefined
              }
              help="Perubahan antara dua penutupan yang tersedia."
            />
            <Metric
              label="Indikator perhatian"
              value={`${data.compositeScore ?? data.risk}/100`}
              help={metricHelp('Indikator perhatian')}
            />
            <Metric
              label="Volume spike"
              value={data.volumeSpike}
              help={metricHelp('Volume spike')}
            />
          </div>
          <nav
            className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--rasi-border)]"
            aria-label="Bagian detail saham"
          >
            {[
              ['summary', 'Ringkasan'],
              ['fundamental', 'Fundamental'],
              ['broker', 'Broker'],
              ['news', 'Berita'],
              ['insider', 'Orang dalam'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => router.push(`/saham/${symbol}?tab=${value}`, { scroll: false })}
                className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold ${activeTab === value ? 'border-blue-600 text-blue-600' : 'border-transparent text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]'}`}
                aria-current={activeTab === value ? 'page' : undefined}
              >
                {label}
              </button>
            ))}
          </nav>
          {activeTab !== 'summary' && (
            <article className="mt-6 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-6">
              {activeTab === 'fundamental' && (
                <>
                  <h2 className="text-lg font-semibold">Fundamental dan periode</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--rasi-muted)]">
                    Detail rasio berada di ringkasan provider. Snapshot ini menyimpan tanggal harga{' '}
                    <strong>{data.priceDate ?? 'belum tersedia'}</strong>; metrik yang tidak
                    tersedia tidak diisi dengan angka pengganti.
                  </p>
                </>
              )}
              {activeTab === 'broker' && (
                <>
                  <h2 className="text-lg font-semibold">Arus broker</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--rasi-muted)]">
                    {broker?.flowSummary ?? 'Data broker belum tersedia untuk periode ini.'}
                  </p>
                  {broker && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Evidence label="CR3 pembeli" value={`${broker.cr3Buy}%`} />
                      <Evidence label="CR3 penjual" value={`${broker.cr3Sell}%`} />
                      <Evidence label="Periode" value={broker.date} />
                    </div>
                  )}
                </>
              )}
              {activeTab === 'news' && (
                <>
                  <h2 className="text-lg font-semibold">Berita dan respons harga</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--rasi-muted)]">
                    {catalyst?.verdict ?? 'Belum ada katalis berita yang tersedia.'}
                  </p>
                  <p className="mt-3 text-xs text-[var(--rasi-muted)]">
                    Asal analisis:{' '}
                    {data.newsImpact &&
                    typeof data.newsImpact === 'object' &&
                    'analysisSource' in data.newsImpact
                      ? data.newsImpact.analysisSource === 'GEMINI'
                        ? 'Gemini'
                        : 'Aturan'
                      : 'Belum diketahui'}
                  </p>
                </>
              )}
              {activeTab === 'insider' && (
                <>
                  <h2 className="text-lg font-semibold">Transaksi orang dalam</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--rasi-muted)]">
                    {insider?.summary ?? 'Belum ada pelaporan terbaru.'}
                  </p>
                  {insider?.latestFiling && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Evidence label="Pelapor" value={insider.latestFiling.holderName} />
                      <Evidence label="Aksi" value={insider.latestFiling.action} />
                      <Evidence label="Tanggal" value={insider.latestFiling.date} />
                    </div>
                  )}
                </>
              )}
            </article>
          )}
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
            <article className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Apa yang terjadi?</h2>
                  <p className="mt-1 text-sm text-[var(--rasi-muted)]">
                    Ringkasan yang dapat ditelusuri ke indikator di bawah.
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
                  {data.status}
                </span>
              </div>
              <p className="mt-5 leading-7">{data.reason}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Evidence
                  label="Bandarmology"
                  value={data.bandarmology ? 'Tersedia' : 'Belum tersedia'}
                />
                <Evidence
                  label="Katalis berita"
                  value={data.catalystDivergence ? 'Tersedia' : 'Belum tersedia'}
                />
                <Evidence
                  label="Transaksi orang dalam"
                  value={data.insiderMovement ? 'Tersedia' : 'Belum tersedia'}
                />
                <Evidence
                  label="Waktu analisis"
                  value={new Date(data.createdAt).toLocaleString('id-ID')}
                />
              </div>
            </article>
            <article className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-6">
              <h2 className="text-lg font-semibold">Yang perlu diperhatikan</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--rasi-muted)]">
                <li className="flex gap-2">
                  <Info className="mt-1 h-4 w-4 shrink-0 text-blue-600" /> Skor ini membantu
                  memprioritaskan pemeriksaan, bukan keputusan otomatis.
                </li>
                <li className="flex gap-2">
                  <Info className="mt-1 h-4 w-4 shrink-0 text-blue-600" /> Pastikan tanggal harga,
                  fundamental, berita, dan broker tidak tercampur.
                </li>
                <li className="flex gap-2">
                  <Info className="mt-1 h-4 w-4 shrink-0 text-blue-600" /> Data yang tidak tersedia
                  tetap ditampilkan sebagai keterbatasan.
                </li>
              </ul>
              <button
                type="button"
                onClick={() => void run()}
                className="rasi-button-secondary mt-6 w-full"
              >
                <RefreshCw className="h-4 w-4" /> Perbarui analisis
              </button>
            </article>
          </div>
          <div className="mt-6 flex items-center justify-between rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-4 py-3 text-xs text-[var(--rasi-muted)]">
            <span>Sumber data dan tanggal tersedia pada detail analisis.</span>
            <Link href="/belajar" className="font-semibold text-blue-600 hover:underline">
              Pelajari istilah
            </Link>
          </div>
        </>
      )}
    </section>
  )
}

function Metric({
  label,
  value,
  help,
  trend,
}: {
  label: string
  value: string | number | null
  help: string
  trend?: 'up' | 'down'
}) {
  return (
    <div className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-4">
      <p className="text-xs text-[var(--rasi-muted)]">{label}</p>
      <div className="mt-2 flex items-center gap-2 text-xl font-bold tabular-nums">
        {trend === 'up' && <ArrowUpRight className="h-5 w-5 text-emerald-600" />}
        {trend === 'down' && <ArrowDownRight className="h-5 w-5 text-rose-600" />}
        {value ?? 'Belum tersedia'}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-[var(--rasi-muted)]">{help}</p>
    </div>
  )
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--rasi-border)] p-3">
      <p className="text-xs text-[var(--rasi-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}
