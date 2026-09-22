/**
 * Two-Tier Scanner Candidate Discovery:
 * Selects up to 8 candidate tickers deterministically across 4 dimensions:
 * - 2 from largest price movement
 * - 2 from largest absolute foreign flow
 * - 2 from most recent publications (news/filings)
 * - 2 from fundamental changes
 * Deduplicates tickers. Empty slots filled by rotating through available sources.
 */

export interface DiscoverySources {
  priceMovers?: Array<{ symbol: string; absoluteChange: number }>
  foreignFlowMovers?: Array<{ symbol: string; absoluteFlow: number }>
  publications?: Array<{ symbol: string; timestamp: string }>
  fundamentalMovers?: Array<{ symbol: string; score: number }>
}

export function selectCandidates(sources: DiscoverySources, targetCount = 8): string[] {
  const selected = new Set<string>()

  // 1. Sort each bucket deterministically
  const priceList = (sources.priceMovers ?? [])
    .slice()
    .sort((a, b) => b.absoluteChange - a.absoluteChange || a.symbol.localeCompare(b.symbol))
    .map((x) => x.symbol)

  const flowList = (sources.foreignFlowMovers ?? [])
    .slice()
    .sort((a, b) => b.absoluteFlow - a.absoluteFlow || a.symbol.localeCompare(b.symbol))
    .map((x) => x.symbol)

  const pubList = (sources.publications ?? [])
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || a.symbol.localeCompare(b.symbol))
    .map((x) => x.symbol)

  const fundList = (sources.fundamentalMovers ?? [])
    .slice()
    .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
    .map((x) => x.symbol)

  const buckets = [priceList, flowList, pubList, fundList]

  // Primary allocation: up to 2 per bucket
  for (const bucket of buckets) {
    let takenFromBucket = 0
    for (const sym of bucket) {
      if (takenFromBucket >= 2) break
      if (!selected.has(sym)) {
        selected.add(sym)
        takenFromBucket++
      }
    }
  }

  // If fewer than targetCount, rotate through buckets to fill remaining slots
  let progress = true
  while (selected.size < targetCount && progress) {
    progress = false
    for (const bucket of buckets) {
      if (selected.size >= targetCount) break
      for (const sym of bucket) {
        if (!selected.has(sym)) {
          selected.add(sym)
          progress = true
          break
        }
      }
    }
  }

  return Array.from(selected)
}
