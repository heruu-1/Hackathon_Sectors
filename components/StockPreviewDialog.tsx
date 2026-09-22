'use client'

import { useEffect, useState } from 'react'

import { ArrowUpRight, ExternalLink, Loader2 } from 'lucide-react'

import { getStockData } from '@/app/actions'
import { ButtonLink, Dialog } from '@/components/ui'
import { getStatusLabel } from '@/lib/presentation/stock'
import type { StockDataResult } from '@/lib/server/services/analysis'

export interface StockPreviewDialogProps {
  ticker: string | null
  open: boolean
  onClose: () => void
}

export function StockPreviewDialog({ ticker, open, onClose }: StockPreviewDialogProps) {
  const [data, setData] = useState<StockDataResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !ticker) return

    let isMounted = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      setData(null)

      void getStockData(ticker)
        .then((res) => {
          if (!isMounted) return
          if (res.success && res.data) {
            setData(res.data)
          } else {
            setError(res.error || 'Gagal memuat pratinjau saham.')
          }
        })
        .catch((err) => {
          if (!isMounted) return
          const msg = err instanceof Error ? err.message : 'Gagal memuat pratinjau.'
          if (
            msg.includes('was not found on the server') ||
            msg.includes('Failed to find Server Action')
          ) {
            setError('Aplikasi telah diperbarui. Muat ulang halaman untuk melanjutkan.')
            return
          }
          setError(msg)
        })
        .finally(() => {
          if (isMounted) setLoading(false)
        })
    }, 0)

    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [open, ticker])

  if (!ticker) return null

  const formattedPrice = data?.price ? `Rp ${data.price.toLocaleString('id-ID')}` : '—'
  const changeFraction = data?.priceChangeFraction
  const formattedChange =
    changeFraction !== null && changeFraction !== undefined
      ? `${changeFraction > 0 ? '+' : ''}${(changeFraction * 100).toFixed(2)}%`
      : '—'

  const isUp = changeFraction !== null && changeFraction !== undefined && changeFraction > 0
  const isDown = changeFraction !== null && changeFraction !== undefined && changeFraction < 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Pratinjau ${ticker}`}
      description={data?.companyName || 'Ringkasan saham di Bursa Efek Indonesia'}
      role="preview"
    >
      {loading && (
        <div className="flex min-h-[220px] items-center justify-center text-sm text-[var(--rasi-muted)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-[var(--rasi-primary)]" />
          Memuat data ringkas {ticker}…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-[#1a080a] dark:text-rose-200">
          <p>{error}</p>
          <div className="mt-4">
            <ButtonLink href={`/saham/${ticker}`} variant="primary" size="sm">
              Buka detail saham <ArrowUpRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-5">
          {/* Header metric row */}
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[var(--rasi-border)] pb-4">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-2xl font-bold text-[var(--rasi-text)] tabular-nums">
                  {formattedPrice}
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    isUp
                      ? 'text-[var(--rasi-success)]'
                      : isDown
                        ? 'text-[var(--rasi-danger)]'
                        : 'text-[var(--rasi-muted)]'
                  }`}
                >
                  {formattedChange}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--rasi-muted)]">
                Tanggal data: {data.priceDate ?? 'Terkini'}
              </p>
            </div>
            <div>
              <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--rasi-text)]">
                {getStatusLabel(data.composite?.status).label}
              </span>
            </div>
          </div>

          {/* Observed conditions & summary */}
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-[var(--rasi-muted)] uppercase">
              Kondisi yang terlihat
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--rasi-text)]">
              {data.composite?.reason ||
                'Belum ada hal khusus yang ditandai dari data yang tersedia.'}
            </p>
          </div>

          {/* Indicators grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-3">
              <span className="block text-[11px] text-[var(--rasi-muted)]">
                {' '}
                Harga dibanding laba (P/E){' '}
              </span>
              <span className="mt-1 block font-mono text-sm font-bold tabular-nums">
                {data.indicators.fundamental.pe !== null
                  ? `${data.indicators.fundamental.pe.toFixed(1)}x`
                  : 'Data belum cukup'}
              </span>
            </div>
            <div className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-3">
              <span className="block text-[11px] text-[var(--rasi-muted)]"> Transaksi broker </span>
              <span className="mt-1 block text-sm font-bold">
                {getStatusLabel(data.indicators.bandarmology.status).label}
              </span>
            </div>
            <div className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-3">
              <span className="block text-[11px] text-[var(--rasi-muted)]">
                {' '}
                Lonjakan jumlah transaksi{' '}
              </span>
              <span className="mt-1 block font-mono text-sm font-bold tabular-nums">
                {data.indicators.volume.formattedRatio}
              </span>
            </div>
            <div className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-3">
              <span className="block text-[11px] text-[var(--rasi-muted)]">
                {' '}
                Transaksi pengurus dan pemegang saham besar{' '}
              </span>
              <span className="mt-1 block text-sm font-bold">
                {getStatusLabel(data.indicators.insider.status).label}
              </span>
            </div>
          </div>

          {/* Sources and limitations */}
          <div className="space-y-1 border-t border-[var(--rasi-border)] pt-3 text-xs text-[var(--rasi-muted)]">
            <p>
              <strong>Sumber:</strong> Sectors dan perhitungan RASI, memakai harga penutupan
              bursa{' '}
            </p>
            <p>Pratinjau ini bersifat informatif dan bukan rekomendasi investasi.</p>
          </div>

          {/* Action button */}
          <div className="flex justify-end pt-2">
            <ButtonLink
              href={`/saham/${ticker}`}
              variant="primary"
              size="md"
              icon={ExternalLink}
              iconPosition="right"
              onClick={onClose}
            >
              Buka detail saham
            </ButtonLink>
          </div>
        </div>
      )}
    </Dialog>
  )
}
