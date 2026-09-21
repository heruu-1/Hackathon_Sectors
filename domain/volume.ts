import type { VolumeSpikeIndicator } from '../lib/contracts/analysis.ts'
import type { DailyPriceRow } from '../lib/contracts/market.ts'

/**
 * Calculates volume spike based on SMA-20 of prior trading sessions.
 * Requires at least 21 valid chronological trading sessions (20 prior sessions + 1 current session).
 * Fewer than 21 sessions will return status 'UNKNOWN' with a descriptive message.
 */
export function calculateVolumeSpike(dailyRows: DailyPriceRow[]): VolumeSpikeIndicator {
  if (!dailyRows || dailyRows.length === 0) {
    return {
      dataState: 'empty',
      spikeRatio: null,
      formattedRatio: 'Tidak ada data volume',
      status: 'UNKNOWN',
      todayVolume: null,
      avgVolume: null,
      observationCount: 0,
      dateRange: { start: null, end: null },
    }
  }

  // Filter valid rows with finite volume and sort chronologically
  const validRows = dailyRows
    .filter((r) => r && typeof r.date === 'string' && Number.isFinite(r.volume) && r.volume >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  const count = validRows.length
  const dateRange = {
    start: validRows[0]?.date ?? null,
    end: validRows[count - 1]?.date ?? null,
  }

  if (count < 21) {
    const latestVolume = validRows[count - 1]?.volume ?? 0
    return {
      dataState: 'partial',
      spikeRatio: null,
      formattedRatio: `Data belum cukup (${count}/21 hari bursa)`,
      status: 'UNKNOWN',
      todayVolume: latestVolume,
      avgVolume: null,
      observationCount: count,
      dateRange,
    }
  }

  const latestSession = validRows[count - 1]
  const todayVolume = latestSession.volume
  const prior20Sessions = validRows.slice(count - 21, count - 1)

  const sumVolume = prior20Sessions.reduce((acc, row) => acc + row.volume, 0)
  const avgVolume = sumVolume / 20

  if (avgVolume <= 0) {
    return {
      dataState: 'ready',
      spikeRatio: null,
      formattedRatio: 'Rata-rata volume 0',
      status: 'UNKNOWN',
      todayVolume,
      avgVolume: 0,
      observationCount: count,
      dateRange,
    }
  }

  const ratio = Number((todayVolume / avgVolume).toFixed(2))

  let status: VolumeSpikeIndicator['status'] = 'NORMAL'
  if (ratio >= 2.5) {
    status = 'EXTREME'
  } else if (ratio >= 1.5) {
    status = 'HIGH'
  } else if (ratio < 0.6) {
    status = 'LOW'
  }

  return {
    dataState: 'ready',
    spikeRatio: ratio,
    formattedRatio: `${ratio}x`,
    status,
    todayVolume,
    avgVolume: Math.round(avgVolume),
    observationCount: count,
    dateRange,
  }
}
