import crypto from 'node:crypto'

import type { IntradayBar } from '../../contracts/signal-analysis.ts'
import type { DataEnvelope, DataIssue } from '../../contracts/market.ts'
import { createEmptyEnvelope, createEnvelope, createErrorEnvelope } from '../../contracts/market.ts'
import { isBarInContinuousTrading } from '../../../domain/trading-sessions.ts'

export interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string
        symbol?: string
        exchangeName?: string
        instrumentType?: string
        firstTradeDate?: number
        regularMarketTime?: number
        gmtoffset?: number
        timezone?: string
        exchangeTimezoneName?: string
        regularMarketPrice?: number
        chartPreviousClose?: number
        dataGranularity?: string
        range?: string
        validRanges?: string[]
      }
      timestamp?: number[]
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>
          high?: Array<number | null>
          low?: Array<number | null>
          close?: Array<number | null>
          volume?: Array<number | null>
        }>
      }
    }>
    error?: {
      code?: string
      description?: string
    } | null
  }
}

export interface IntradayFetchResult {
  bars: IntradayBar[]
  checksum: string
  delayMinutes: number
  totalRawBars: number
  validBars: number
  nullBars: number
  issues: DataIssue[]
}

// In-memory cache: ticker -> { envelope: DataEnvelope<IntradayBar[]>, expiresAt: number, checksum: string }
const intradayCache = new Map<
  string,
  {
    envelope: DataEnvelope<IntradayBar[]>
    expiresAt: number
    checksum: string
  }
>()

// In-flight requests map to deduplicate concurrent requests for the same ticker
const inFlightRequests = new Map<string, Promise<DataEnvelope<IntradayBar[]>>>()

const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Normalizes ticker for Yahoo Finance IDX queries.
 * Example: 'BMRI' -> 'BMRI.JK', 'bbca.jk' -> 'BBCA.JK'
 */
export function normalizeYahooTicker(ticker: string): string {
  const clean = ticker.trim().toUpperCase()
  if (clean.endsWith('.JK')) {
    return clean
  }
  return `${clean}.JK`
}

/**
 * Parses and validates raw Yahoo Chart JSON into continuous trading IntradayBars.
 * Pure function suitable for direct unit testing.
 */
export function parseYahooChartResponse(
  json: YahooChartResponse,
  expectedTicker: string,
): {
  success: boolean
  data?: IntradayFetchResult
  error?: string
} {
  if (json.chart?.error) {
    return {
      success: false,
      error: `Yahoo API error: ${json.chart.error.description || json.chart.error.code || 'Unknown error'}`,
    }
  }

  const result = json.chart?.result?.[0]
  if (!result) {
    return {
      success: false,
      error: 'Data chart Yahoo tidak ditemukan dalam respons.',
    }
  }

  const timestamps = result.timestamp ?? []
  const quotes = result.indicators?.quote?.[0]
  const opens = quotes?.open ?? []
  const highs = quotes?.high ?? []
  const lows = quotes?.low ?? []
  const closes = quotes?.close ?? []
  const volumes = quotes?.volume ?? []

  const issues: DataIssue[] = []
  const len = timestamps.length

  if (len === 0) {
    return {
      success: true,
      data: {
        bars: [],
        checksum: '',
        delayMinutes: 10,
        totalRawBars: 0,
        validBars: 0,
        nullBars: 0,
        issues: [{ code: 'EMPTY_SERIES', message: 'Tidak ada bar intraday yang ditemukan.' }],
      },
    }
  }

  // Length checks
  if (
    opens.length !== len ||
    highs.length !== len ||
    lows.length !== len ||
    closes.length !== len ||
    volumes.length !== len
  ) {
    return {
      success: false,
      error: 'Struktur array indikator Yahoo tidak konsisten (panjang array berbeda).',
    }
  }

  const bars: IntradayBar[] = []
  let nullBars = 0
  let prevTs = 0
  const cleanTicker = expectedTicker.trim().toUpperCase().replace(/\.JK$/, '')
  const hash = crypto.createHash('sha256')

  for (let i = 0; i < len; i++) {
    const ts = timestamps[i]

    // Verify ascending timestamp
    if (ts <= prevTs) {
      issues.push({
        code: 'NON_ASCENDING_TIMESTAMP',
        message: `Timestamp tidak menaik pada indeks ${i} (ts: ${ts}, prev: ${prevTs})`,
      })
    }
    prevTs = ts

    const o = opens[i]
    const h = highs[i]
    const l = lows[i]
    const c = closes[i]
    const v = volumes[i]

    // Empty bar check: preserve null without imputing 0 or interpolating
    if (o === null || h === null || l === null || c === null || o === undefined || h === undefined || l === undefined || c === undefined) {
      nullBars++
      continue
    }

    // Number validation
    if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(c)) {
      nullBars++
      continue
    }

    // Value positivity & relationship checks
    if (o <= 0 || h <= 0 || l <= 0 || c <= 0) {
      issues.push({
        code: 'NON_POSITIVE_PRICE',
        message: `Harga non-positif pada bar ${ts}: O=${o}, H=${h}, L=${l}, C=${c}`,
      })
      continue
    }

    if (h < l || h < o || h < c || l > o || l > c) {
      issues.push({
        code: 'INVALID_BAR_RELATION',
        message: `Hubungan High/Low/Open/Close tidak valid pada bar ${ts}: O=${o}, H=${h}, L=${l}, C=${c}`,
      })
      continue
    }

    const vol = v !== null && v !== undefined && !isNaN(v) && v >= 0 ? v : 0

    // 5-minute bar start and end
    const startAt = new Date(ts * 1000).toISOString()
    const endAt = new Date((ts + 300) * 1000).toISOString()

    // Filter strictly to continuous trading sessions (S1 or S2)
    const sessionCheck = isBarInContinuousTrading(startAt, endAt)
    if (!sessionCheck.isValidContinuous) {
      continue
    }

    const bar: IntradayBar = {
      ticker: cleanTicker,
      startAt,
      endAt,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: vol,
      source: 'YAHOO',
    }

    bars.push(bar)
    hash.update(`${startAt}:${o}:${h}:${l}:${c}:${vol},`)
  }

  const checksum = hash.digest('hex')

  return {
    success: true,
    data: {
      bars,
      checksum,
      delayMinutes: 10, // IDX Yahoo data is ~10 min delayed
      totalRawBars: len,
      validBars: bars.length,
      nullBars,
      issues,
    },
  }
}

/**
 * Fetches intraday 5m data for a ticker from Yahoo Finance.
 * Uses 10s timeout, in-memory 15m cache, and deduplicates concurrent requests.
 */
export async function fetchIntradayPrices(
  ticker: string,
  options?: { bypassCache?: boolean },
): Promise<DataEnvelope<IntradayBar[]>> {
  const cleanTicker = ticker.trim().toUpperCase().replace(/\.JK$/, '')
  const now = Date.now()

  // 1. Check in-memory cache
  if (!options?.bypassCache) {
    const cached = intradayCache.get(cleanTicker)
    if (cached && cached.expiresAt > now) {
      return cached.envelope
    }
  }

  // 2. Deduplicate in-flight requests
  const pending = inFlightRequests.get(cleanTicker)
  if (pending) {
    return pending
  }

  const fetchPromise = (async (): Promise<DataEnvelope<IntradayBar[]>> => {
    try {
      const yahooTicker = normalizeYahooTicker(cleanTicker)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?range=60d&interval=5m&includePrePost=false`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      let res: Response
      try {
        res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RASI-MarketIntelligence/2.0)',
            Accept: 'application/json',
          },
        })
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return createErrorEnvelope(
            'YAHOO',
            'Batas waktu 10 detik terlampaui saat menghubungi feed intraday Yahoo.',
            'TIMEOUT',
          )
        }
        return createErrorEnvelope(
          'YAHOO',
          `Gagal menghubungi provider intraday: ${err instanceof Error ? err.message : 'Koneksi terputus'}`,
          'NETWORK_ERROR',
        )
      } finally {
        clearTimeout(timeoutId)
      }

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return createErrorEnvelope(
            'YAHOO',
            'Akses ke endpoint chart Yahoo ditolak (401/403).',
            'AUTH_ERROR',
          )
        }
        if (res.status === 429) {
          return createErrorEnvelope(
            'YAHOO',
            'Batas laju permintaan ke feed Yahoo terlampaui (429 Rate Limit).',
            'RATE_LIMITED',
          )
        }
        return createErrorEnvelope(
          'YAHOO',
          `Feed intraday Yahoo mengembalikan HTTP ${res.status}.`,
          'HTTP_ERROR',
        )
      }

      const json = (await res.json()) as YahooChartResponse
      const parsed = parseYahooChartResponse(json, cleanTicker)

      if (!parsed.success || !parsed.data) {
        return createErrorEnvelope('YAHOO', parsed.error || 'Gagal memproses data chart Yahoo.')
      }

      const { bars, checksum, delayMinutes, issues } = parsed.data

      if (bars.length === 0) {
        return createEmptyEnvelope('YAHOO', null, 'Tidak ada bar intraday sesi kontinu yang valid.')
      }

      const periodStart = bars[0]?.startAt ?? null
      const periodEnd = bars[bars.length - 1]?.endAt ?? null

      const envelope = createEnvelope<IntradayBar[]>({
        state: issues.length > 0 ? 'partial' : 'ready',
        data: bars,
        source: 'YAHOO',
        periodStart,
        periodEnd,
        freshness: 'fresh',
        issues: [
          ...issues,
          {
            code: 'DELAYED_FEED',
            message: `Feed intraday Yahoo BEI memiliki jeda keterlambatan resmi ~${delayMinutes} menit.`,
          },
        ],
      })

      // Cache result
      intradayCache.set(cleanTicker, {
        envelope,
        expiresAt: now + CACHE_TTL_MS,
        checksum,
      })

      return envelope
    } finally {
      inFlightRequests.delete(cleanTicker)
    }
  })()

  inFlightRequests.set(cleanTicker, fetchPromise)
  return fetchPromise
}

/**
 * Clears the intraday cache for a ticker or entirely (useful in tests).
 */
export function clearIntradayCache(ticker?: string): void {
  if (ticker) {
    intradayCache.delete(ticker.trim().toUpperCase().replace(/\.JK$/, ''))
  } else {
    intradayCache.clear()
  }
}
