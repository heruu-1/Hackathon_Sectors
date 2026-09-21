import type { DailyPriceRow } from '../lib/contracts/market.ts'

export const RADAR_TTL_MS = 15 * 60_000

export function isRadarFresh(scannedAt?: string, now = Date.now()): boolean {
  const age = now - Date.parse(scannedAt ?? '')
  return Number.isFinite(age) && age >= 0 && age < RADAR_TTL_MS
}

/** Daily bars cannot establish the response to an intraday event until a later session. */
export function getNewsPriceResponse(
  rows: Pick<DailyPriceRow, 'date' | 'close'>[],
  timestamp?: string,
): number | null {
  const time = Date.parse(timestamp ?? '')
  if (!Number.isFinite(time)) return null
  const eventDate = new Date(time + 7 * 3600_000).toISOString().slice(0, 10)
  const sorted = rows
    .filter((r) => r.date && Number.isFinite(r.close) && r.close > 0)
    .toSorted((a, b) => a.date.localeCompare(b.date))
  const before = sorted.findLast((row) => row.date < eventDate)
  const after = sorted.findLast((row) => row.date > eventDate)
  if (!before || !after) return null
  return (after.close - before.close) / before.close
}

export function visibleRadarHistory<T extends { scannedAt: string }>(
  history: T[],
  hiddenThrough: string | null,
): T[] {
  const cutoff = Date.parse(hiddenThrough ?? '')
  return Number.isFinite(cutoff)
    ? history.filter((item) => Date.parse(item.scannedAt) > cutoff)
    : history
}
