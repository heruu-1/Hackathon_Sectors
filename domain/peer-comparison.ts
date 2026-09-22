/**
 * Peer comparison and relative valuation domain module.
 * Implements percentile ranking (mid-rank), median calculation,
 * fallback from subsector to sector when peers < 5,
 * handling of negative P/E and negative equity P/B, and R06 rule evaluation.
 */
import { normalizeTicker } from './ticker.ts'

export interface PeerValuationInput {
  symbol: string
  sector?: string
  sub_sector?: string
  market_cap?: number | null
  pe?: number | null
  pb?: number | null
  roe?: number | null
  dividend_yield?: number | null
  net_income_growth_yoy?: number | null
  revenue_growth_yoy?: number | null
}

export interface MetricDistribution {
  median: number | null
  min: number | null
  max: number | null
  count: number
}

export interface PeerMetricRank {
  value: number | null
  median: number | null
  diffFromMedian: number | null
  percentile: number | null // 0 - 100 mid-rank percentile
  status:
    'DISCOUNT' | 'PREMIUM' | 'IN_LINE' | 'NEGATIVE_EARNINGS' | 'NEGATIVE_EQUITY' | 'UNAVAILABLE'
  summaryLabel: string
}

export interface PeerComparisonResult {
  targetSymbol: string
  peerGroupType: 'SUB_SECTOR' | 'SECTOR' | 'INSUFFICIENT'
  peerGroupName: string
  totalPeersEvaluated: number
  isSampleSufficient: boolean // true if valid peers >= 5
  peRank: PeerMetricRank
  pbRank: PeerMetricRank
  roeRank: PeerMetricRank
  dividendYieldRank: PeerMetricRank
  ruleR06: {
    triggered: boolean
    explanation: string
  }
  peers: Array<{
    symbol: string
    pe: number | null
    pb: number | null
    roe: number | null
    dividendYield: number | null
    marketCap: number | null
  }>
}

/**
 * Calculates median of an array of numbers.
 */
export function calculateMedian(values: number[]): number | null {
  if (!values || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

/**
 * Calculates mid-rank percentile for target value within an array of numbers.
 * Handles ties by averaging ranks.
 * Returns percentile in 0 - 100 range.
 */
export function calculateMidRankPercentile(
  targetValue: number,
  allValues: number[],
): number | null {
  if (!allValues || allValues.length === 0) return null
  const sorted = [...allValues].sort((a, b) => a - b)
  const n = sorted.length

  // Find occurrences of targetValue
  const firstIndex = sorted.indexOf(targetValue)
  if (firstIndex === -1) {
    // If targetValue is not in allValues, find insertion rank
    let rank = 1
    for (const val of sorted) {
      if (val < targetValue) rank++
      else break
    }
    return Number((((rank - 0.5) / (n + 1)) * 100).toFixed(1))
  }

  const lastIndex = sorted.lastIndexOf(targetValue)
  const tieCount = lastIndex - firstIndex + 1
  const midRank = firstIndex + 1 + (tieCount - 1) / 2 // 1-based mid-rank

  return Number((((midRank - 0.5) / n) * 100).toFixed(1))
}

/**
 * Evaluates a metric rank for target vs peer distribution.
 */
export function evaluateMetricRank(
  targetValue: number | null | undefined,
  peerValues: number[],
  type: 'PE' | 'PB' | 'ROE' | 'DIVIDEND_YIELD',
): PeerMetricRank {
  if (targetValue === null || targetValue === undefined || !Number.isFinite(targetValue)) {
    return {
      value: null,
      median: calculateMedian(peerValues),
      diffFromMedian: null,
      percentile: null,
      status: 'UNAVAILABLE',
      summaryLabel: 'Data tidak tersedia',
    }
  }

  // Handle negative P/E and negative P/B
  if (type === 'PE' && targetValue <= 0) {
    return {
      value: targetValue,
      median: calculateMedian(peerValues),
      diffFromMedian: null,
      percentile: null,
      status: 'NEGATIVE_EARNINGS',
      summaryLabel: 'P/E Negatif (Merugi)',
    }
  }

  if (type === 'PB' && targetValue <= 0) {
    return {
      value: targetValue,
      median: calculateMedian(peerValues),
      diffFromMedian: null,
      percentile: null,
      status: 'NEGATIVE_EQUITY',
      summaryLabel: 'P/B Negatif (Defisiensi Modal)',
    }
  }

  // Filter positive-only values for P/E and P/B peer distributions
  const validPeers =
    type === 'PE' || type === 'PB'
      ? peerValues.filter((v) => v > 0)
      : peerValues.filter((v) => Number.isFinite(v))

  const median = calculateMedian(validPeers)
  const percentile = calculateMidRankPercentile(targetValue, validPeers)
  const diffFromMedian = median !== null ? Number((targetValue - median).toFixed(2)) : null

  let status: PeerMetricRank['status'] = 'IN_LINE'
  let summaryLabel = 'Sejalan dengan median industri'

  if (median !== null && diffFromMedian !== null) {
    const relativeDiff = median !== 0 ? (targetValue - median) / Math.abs(median) : 0

    if (type === 'PE' || type === 'PB') {
      if (relativeDiff < -0.15) {
        status = 'DISCOUNT'
        summaryLabel = `Diskon ${Math.abs(Math.round(relativeDiff * 100))}% vs median`
      } else if (relativeDiff > 0.15) {
        status = 'PREMIUM'
        summaryLabel = `Premi ${Math.round(relativeDiff * 100)}% vs median`
      }
    } else {
      // ROE / Dividend Yield (higher is generally better)
      if (relativeDiff > 0.15) {
        status = 'PREMIUM'
        summaryLabel = `Lebih tinggi ${Math.round(relativeDiff * 100)}% vs median`
      } else if (relativeDiff < -0.15) {
        status = 'DISCOUNT'
        summaryLabel = `Lebih rendah ${Math.abs(Math.round(relativeDiff * 100))}% vs median`
      }
    }
  }

  return {
    value: targetValue,
    median,
    diffFromMedian,
    percentile,
    status,
    summaryLabel,
  }
}

/**
 * Performs full peer comparison for a target company against candidate peers.
 * Automatically falls back from subsector to sector if valid peer count < 5.
 */
export function compareTargetWithPeers(
  target: PeerValuationInput,
  candidatePeers: PeerValuationInput[],
): PeerComparisonResult {
  const targetSymbol = normalizeTicker(target.symbol)

  // Separate candidates matching subsector vs sector
  const subSectorCandidates = candidatePeers.filter(
    (p) =>
      normalizeTicker(p.symbol) !== targetSymbol &&
      p.sub_sector &&
      target.sub_sector &&
      p.sub_sector.toLowerCase() === target.sub_sector.toLowerCase(),
  )

  const sectorCandidates = candidatePeers.filter(
    (p) =>
      normalizeTicker(p.symbol) !== targetSymbol &&
      p.sector &&
      target.sector &&
      p.sector.toLowerCase() === target.sector.toLowerCase(),
  )

  let peerGroupType: 'SUB_SECTOR' | 'SECTOR' | 'INSUFFICIENT' = 'SUB_SECTOR'
  let peerGroupName = target.sub_sector ?? 'Subsektor'
  let selectedPeers = subSectorCandidates

  // Fallback to sector if subsector has fewer than 5 peers
  if (selectedPeers.length < 5) {
    if (sectorCandidates.length >= 5) {
      peerGroupType = 'SECTOR'
      peerGroupName = target.sector ?? 'Sektor'
      selectedPeers = sectorCandidates
    } else {
      peerGroupType = 'INSUFFICIENT'
      peerGroupName = target.sub_sector ?? target.sector ?? 'Kelompok Industri'
      // Use what we have
      selectedPeers =
        sectorCandidates.length > selectedPeers.length ? sectorCandidates : selectedPeers
    }
  }

  const isSampleSufficient = selectedPeers.length >= 5

  // Collect peer values (including target for full distribution)
  const allPeersWithTarget = [...selectedPeers, target]

  const peValues = allPeersWithTarget
    .map((p) => p.pe)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  const pbValues = allPeersWithTarget
    .map((p) => p.pb)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  const roeValues = allPeersWithTarget
    .map((p) => p.roe)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  const divYieldValues = allPeersWithTarget
    .map((p) => p.dividend_yield)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  const peRank = evaluateMetricRank(target.pe, peValues, 'PE')
  const pbRank = evaluateMetricRank(target.pb, pbValues, 'PB')
  const roeRank = evaluateMetricRank(target.roe, roeValues, 'ROE')
  const dividendYieldRank = evaluateMetricRank(
    target.dividend_yield,
    divYieldValues,
    'DIVIDEND_YIELD',
  )

  // Rule R06: Cheap Valuation with Deteriorating Earnings
  // Triggered when:
  // - PE or PB is in discount (< median by at least 10%)
  // - AND net income growth is negative (< 0) or revenue growth is negative (< 0)
  const isCheap =
    (peRank.diffFromMedian !== null && peRank.diffFromMedian < 0 && peRank.status === 'DISCOUNT') ||
    (pbRank.diffFromMedian !== null && pbRank.diffFromMedian < 0 && pbRank.status === 'DISCOUNT')

  const isDeteriorating =
    (typeof target.net_income_growth_yoy === 'number' && target.net_income_growth_yoy < 0) ||
    (typeof target.revenue_growth_yoy === 'number' && target.revenue_growth_yoy < 0)

  const r06Triggered = isCheap && isDeteriorating
  const r06Explanation = r06Triggered
    ? `Valuasi ${targetSymbol} tampak murah (P/E atau P/B di bawah median industri), namun pertumbuhan laba atau pendapatan melemah/negatif (${target.net_income_growth_yoy ? (target.net_income_growth_yoy * 100).toFixed(1) + '%' : 'negatif'}). Periksa apakah diskon mencerminkan risiko pelemahan bisnis.`
    : isCheap
      ? `Valuasi ${targetSymbol} di bawah median industri dengan pertumbuhan laba yang tetap terjaga.`
      : `Valuasi ${targetSymbol} sejalan atau di atas median industri.`

  // Format top peers for display
  const peersFormatted = selectedPeers.slice(0, 10).map((p) => ({
    symbol: normalizeTicker(p.symbol),
    pe: typeof p.pe === 'number' ? Number(p.pe.toFixed(2)) : null,
    pb: typeof p.pb === 'number' ? Number(p.pb.toFixed(2)) : null,
    roe: typeof p.roe === 'number' ? Number(p.roe.toFixed(4)) : null,
    dividendYield:
      typeof p.dividend_yield === 'number' ? Number(p.dividend_yield.toFixed(4)) : null,
    marketCap: p.market_cap ?? null,
  }))

  return {
    targetSymbol,
    peerGroupType,
    peerGroupName,
    totalPeersEvaluated: selectedPeers.length,
    isSampleSufficient,
    peRank,
    pbRank,
    roeRank,
    dividendYieldRank,
    ruleR06: {
      triggered: r06Triggered,
      explanation: r06Explanation,
    },
    peers: peersFormatted,
  }
}
