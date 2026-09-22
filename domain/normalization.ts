/**
 * Normalization module for RASI Market Intelligence.
 * Guarantees consistent handling of dates, prices, units, and missing values.
 */

export interface NormalizedPricePoint {
  date: string // YYYY-MM-DD
  close: number
  open: number | null
  high: number | null
  low: number | null
  volume: number // lembar saham
  lotVolume: number // lot (volume / 100)
  marketCap: number | null
}

export function parseTradingDate(val: unknown): string | null {
  if (typeof val !== 'string') return null
  const trimmed = val.trim()
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

export function formatWibDateTime(isoStringOrDate: string | Date | null): string | null {
  if (!isoStringOrDate) return null
  const date = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate
  if (isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function parseNumberOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

export function sharesToLots(shares: number): number {
  return Math.floor(shares / 100)
}

export function lotsToShares(lots: number): number {
  return lots * 100
}

/**
 * Normalizes an array of raw daily price points.
 * Sorts strictly by date ascending, deduplicates dates, and handles nulls cleanly.
 * Input ordering does NOT affect the output.
 */
export function normalizePriceSeries(raw: unknown[]): NormalizedPricePoint[] {
  if (!Array.isArray(raw)) return []

  const dateMap = new Map<string, NormalizedPricePoint>()

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const date = parseTradingDate(r.date ?? r.trade_date ?? r.time)
    if (!date) continue

    const close = parseNumberOrNull(r.close ?? r.price ?? r.last_price)
    if (close === null || close < 0) continue

    const volume = Math.max(0, parseNumberOrNull(r.volume ?? r.vol) ?? 0)
    const open = parseNumberOrNull(r.open)
    const high = parseNumberOrNull(r.high)
    const low = parseNumberOrNull(r.low)
    const marketCap = parseNumberOrNull(r.market_cap ?? r.marketCap)

    dateMap.set(date, {
      date,
      close,
      open,
      high,
      low,
      volume,
      lotVolume: sharesToLots(volume),
      marketCap,
    })
  }

  // Sort strictly ascending by date
  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Calculates N-session return. Requires at least N+1 observations.
 * Formula: close(t) / close(t-N) - 1.
 */
export function calculateNSessionReturn(
  series: NormalizedPricePoint[],
  nSessions: number,
): number | null {
  if (!series || series.length < nSessions + 1) return null
  const current = series[series.length - 1].close
  const past = series[series.length - 1 - nSessions].close
  if (past <= 0) return null
  return current / past - 1
}

/**
 * Calculates percentage point difference (e.g. 15.5% - 10.2% = 5.3 percentage points).
 */
export function calculatePercentagePoints(
  currentFraction: number | null,
  previousFraction: number | null,
): number | null {
  if (currentFraction === null || previousFraction === null) return null
  return Number(((currentFraction - previousFraction) * 100).toFixed(4))
}
