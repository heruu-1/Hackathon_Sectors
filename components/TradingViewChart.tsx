'use client'

import { memo, useEffect, useRef, useState } from 'react'

import { AlertCircle, ExternalLink } from 'lucide-react'

import { useThemePreference } from '@/components/ThemePreferenceProvider'

export interface TradingViewChartProps {
  symbol: string
  theme?: 'dark' | 'light'
  height?: number | string
}

function resolveEffectiveTheme(themePref?: 'system' | 'light' | 'dark'): 'dark' | 'light' {
  if (themePref === 'dark') return 'dark'
  if (themePref === 'light') return 'light'
  if (typeof window !== 'undefined') {
    const domTheme = document.documentElement.dataset.rasiTheme
    if (domTheme === 'dark' || domTheme === 'light') return domTheme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
  }
  return 'dark'
}

export const TradingViewChart = memo(function TradingViewChart({
  symbol,
  theme,
  height,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { theme: contextTheme } = useThemePreference()
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark')

  const cleanSymbol = symbol.trim().toUpperCase().replace(/\.JK$/i, '')

  // Responsive height calculation: mobile 380px, tablet 480px, desktop 580px
  const [responsiveHeight, setResponsiveHeight] = useState<number>(() => {
    if (typeof height === 'number') return height
    if (typeof height === 'string') return parseInt(height, 10) || 580
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) return 380
      if (window.innerWidth < 1024) return 480
      return 580
    }
    return 580
  })

  useEffect(() => {
    if (height !== undefined) {
      setResponsiveHeight(typeof height === 'number' ? height : parseInt(String(height), 10) || 580)
      return
    }
    const handleResize = () => {
      const w = window.innerWidth
      if (w < 640) setResponsiveHeight(380)
      else if (w < 1024) setResponsiveHeight(480)
      else setResponsiveHeight(580)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [height])

  const numericHeight = responsiveHeight

  useEffect(() => {
    const updateTheme = () => {
      setResolvedTheme(theme ?? resolveEffectiveTheme(contextTheme))
    }
    updateTheme()

    if (!theme && contextTheme === 'system' && typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => updateTheme()
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [theme, contextTheme])

  const activeTheme = theme ?? resolvedTheme

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    setLoadFailed(false)
    container.innerHTML = ''

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.height = `${numericHeight}px`
    widgetDiv.style.minHeight = `${numericHeight}px`
    widgetDiv.style.width = '100%'
    container.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: false,
      width: '100%',
      height: numericHeight,
      symbol: `IDX:${cleanSymbol}`,
      interval: 'D',
      timezone: 'Asia/Jakarta',
      theme: activeTheme,
      style: '1',
      locale: 'id',
      enable_publishing: false,
      allow_symbol_change: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      hide_legend: false,
      save_image: true,
      show_popup_button: true,
      popup_width: '1000',
      popup_height: '650',
      withdateranges: true,
      details: false,
      hotlist: false,
      studies: ['STD;SMA', 'STD;Volume'],
    })

    script.onerror = () => {
      setLoadFailed(true)
    }

    container.appendChild(script)

    const timeout = window.setTimeout(() => {
      if (!container.querySelector('iframe')) setLoadFailed(true)
    }, 15_000)

    return () => {
      window.clearTimeout(timeout)
      script.onerror = null
      if (container) {
        container.innerHTML = ''
      }
    }
  }, [cleanSymbol, activeTheme, numericHeight, attempt])

  const errorPanel = loadFailed ? (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-8 text-center text-sm text-[var(--rasi-muted)]"
      style={{ minHeight: `${numericHeight}px`, height: `${numericHeight}px` }}
    >
      <AlertCircle className="mb-2 h-8 w-8 text-amber-500" />
      <p className="font-semibold text-[var(--rasi-text)]">
        {' '}
        Grafik TradingView belum bisa dibuka{' '}
      </p>
      <p className="mt-1 max-w-md text-xs">
        {' '}
        Periksa koneksi internet dan coba lagi. Jika riwayat harga tersedia, Anda juga bisa memilih
        Grafik RASI.{' '}
      </p>
      <button
        type="button"
        onClick={() => setAttempt((value) => value + 1)}
        className="mt-4 rounded-lg border border-[var(--rasi-border)] px-3 py-2 font-semibold text-[var(--rasi-primary)]"
      >
        Coba muat grafik lagi
      </button>
      <a
        href={`https://www.tradingview.com/symbols/IDX-${cleanSymbol}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1 rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--rasi-primary)] hover:underline"
      >
        Buka di TradingView.com <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  ) : null

  return (
    <div
      className="tradingview-chart-wrapper w-full overflow-hidden rounded-2xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] shadow-[var(--rasi-card-shadow)]"
      style={{ minHeight: `${numericHeight}px`, height: `${numericHeight}px` }}
    >
      {errorPanel}
      <div
        ref={containerRef}
        className="tradingview-widget-container h-full w-full"
        style={{
          display: loadFailed ? 'none' : undefined,
          minHeight: `${numericHeight}px`,
          height: `${numericHeight}px`,
        }}
      >
        <div
          className="tradingview-widget-container__widget h-full w-full"
          style={{ minHeight: `${numericHeight}px`, height: `${numericHeight}px` }}
        />
      </div>
    </div>
  )
})
