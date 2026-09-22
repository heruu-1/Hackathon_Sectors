/**
 * Universe domain logic: models and structures for IDX companies and sector metadata.
 */

export interface UniverseCompany {
  symbol: string
  name: string
  sector: string
  subSector?: string
  marketCap?: number | null
  lastPrice?: number | null
  dailyChange?: number | null
  date?: string | null
}

export interface UniversePage {
  companies: UniverseCompany[]
  totalCount: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface SectorSummary {
  sector: string
  totalCompanies: number
  advancing: number
  declining: number
  unchanged: number
  medianChangeFraction: number | null
  topGainers: UniverseCompany[]
  topLosers: UniverseCompany[]
  netForeignFlow?: number | null
}

export function groupCompaniesBySector(
  companies: UniverseCompany[],
): Map<string, UniverseCompany[]> {
  const map = new Map<string, UniverseCompany[]>()
  for (const c of companies) {
    const sector = c.sector || 'Lainnya'
    const list = map.get(sector) ?? []
    list.push(c)
    map.set(sector, list)
  }
  return map
}

export function calculateMedian(numbers: number[]): number | null {
  if (numbers.length === 0) return null
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 !== 0) {
    return sorted[mid]
  }
  return (sorted[mid - 1] + sorted[mid]) / 2
}

export function summarizeSector(sector: string, companies: UniverseCompany[]): SectorSummary {
  let advancing = 0
  let declining = 0
  let unchanged = 0
  const validChanges: number[] = []

  for (const c of companies) {
    if (c.dailyChange === null || c.dailyChange === undefined) {
      continue
    }
    if (c.dailyChange > 0) advancing++
    else if (c.dailyChange < 0) declining++
    else unchanged++

    validChanges.push(c.dailyChange)
  }

  const sortedByChange = [...companies]
    .filter((c) => c.dailyChange !== null && c.dailyChange !== undefined)
    .sort((a, b) => (b.dailyChange ?? 0) - (a.dailyChange ?? 0))

  const topGainers = sortedByChange.slice(0, 3)
  const topLosers = [...sortedByChange].reverse().slice(0, 3)

  return {
    sector,
    totalCompanies: companies.length,
    advancing,
    declining,
    unchanged,
    medianChangeFraction: calculateMedian(validChanges),
    topGainers,
    topLosers,
  }
}
