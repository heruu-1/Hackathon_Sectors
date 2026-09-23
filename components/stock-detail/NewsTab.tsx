'use client'

import { ExternalLink } from 'lucide-react'

import {
  getNewsCategoryLabel,
  getNewsSentimentLabel,
  getStatusLabel,
} from '@/lib/presentation/stock'
import type { StockDataResult } from '@/lib/server/services/analysis'

export interface NewsTabProps {
  data: StockDataResult
  symbol: string
  divergence: StockDataResult['indicators']['divergence']
}

export function NewsTab({ data, symbol, divergence }: NewsTabProps) {
  const allNews = data?.envelopes?.news?.data ?? []
  const latestArticle = allNews[0]
  const otherNews = allNews.slice(1)

  const featuredUrl =
    divergence.newsUrl ||
    (latestArticle?.source?.startsWith('http') ? latestArticle.source : null) ||
    (divergence.headline
      ? `https://www.google.com/search?q=${encodeURIComponent(`${symbol} ${divergence.headline}`)}`
      : null)

  let featuredSourceName = 'Berita Pasar'
  if (latestArticle?.source) {
    if (latestArticle.source.startsWith('http')) {
      try {
        featuredSourceName = new URL(latestArticle.source).hostname.replace(/^www\./, '')
      } catch {
        featuredSourceName = 'Sumber Berita'
      }
    } else {
      featuredSourceName = latestArticle.source
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-[var(--rasi-text)]">Berita dan perubahan harga</h3>
        <p className="mt-1 text-xs text-[var(--rasi-muted)]">
          Bandingkan berita perusahaan dengan perubahan harga sahamnya.
        </p>
      </div>

      {/* Kartu Utama: Analisis Respons Pasar terhadap Berita Terkini */}
      <div className="space-y-4 rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rasi-border)] pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--rasi-text)]">
              Perubahan harga: {getStatusLabel(divergence.status).label}
            </span>
            <span className="rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--rasi-text)]">
              Isi berita: {getNewsSentimentLabel(divergence.sentiment)}
            </span>
          </div>
          <span className="text-xs text-[var(--rasi-muted)]">
            Kategori: {getNewsCategoryLabel(divergence.catalystType)}
          </span>
        </div>

        {divergence.headline ? (
          <div>
            <a
              href={featuredUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-start gap-1.5 text-base font-semibold text-[var(--rasi-text)] hover:text-[var(--rasi-primary)] hover:underline"
            >
              <span>{divergence.headline}</span>
              <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-[var(--rasi-muted)] group-hover:text-[var(--rasi-primary)]" />
            </a>
            {latestArticle?.body && (
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--rasi-muted)]">
                {latestArticle.body}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--rasi-muted)]">
            Belum ada berita penting dalam data yang tersedia.
          </p>
        )}

        {divergence.verdict && (
          <div className="rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-3.5">
            <span className="text-[11px] font-bold tracking-wider text-[var(--rasi-muted)] uppercase">
              Hasil Analisis RASI
            </span>
            <p className="mt-1 text-xs leading-relaxed text-[var(--rasi-text)]">
              {divergence.verdict}
            </p>
          </div>
        )}

        <div className="flex justify-between border-t border-[var(--rasi-border)] pt-2 text-[11px] text-[var(--rasi-muted)]">
          <span>Sumber: {featuredSourceName}</span>
          <span>{divergence.newsTimestamp?.split('T')[0] ?? 'Terkini'}</span>
        </div>
      </div>

      {/* Berita Tambahan Lainnya (jika ada lebih dari 1 artikel) */}
      {otherNews.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[var(--rasi-text)]">
            Berita Lainnya ({otherNews.length})
          </h4>
          <div className="divide-y divide-[var(--rasi-border)] rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)]">
            {otherNews.map((item, idx) => {
              const isHttp =
                item.source?.startsWith('http://') || item.source?.startsWith('https://')
              const articleUrl = isHttp
                ? item.source
                : `https://www.google.com/search?q=${encodeURIComponent(`${symbol} ${item.title}`)}`
              let sourceName = 'Berita Pasar'
              if (isHttp) {
                try {
                  sourceName = new URL(item.source).hostname.replace(/^www\./, '')
                } catch {
                  sourceName = 'Sumber Berita'
                }
              } else if (item.source) {
                sourceName = item.source
              }

              return (
                <article
                  key={idx}
                  className="p-4 transition-colors hover:bg-[var(--rasi-muted-bg)]"
                >
                  <a
                    href={articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-start gap-1.5 text-sm font-semibold text-[var(--rasi-text)] hover:text-[var(--rasi-primary)] hover:underline"
                  >
                    <span>{item.title}</span>
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--rasi-muted)] group-hover:text-[var(--rasi-primary)]" />
                  </a>
                  {item.body && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--rasi-muted)]">
                      {item.body}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--rasi-muted)]">
                    <span className="font-medium text-[var(--rasi-text)]/80">{sourceName}</span>
                    <span>•</span>
                    <span>{item.timestamp?.split('T')[0] ?? 'Terkini'}</span>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
