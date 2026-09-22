import {
  type SectorSummary,
  type UniverseCompany,
  calculateMedian,
  groupCompaniesBySector,
  summarizeSector,
} from './universe.ts'

export interface MarketBreadth {
  cutoffDate: string
  totalMonitored: number
  advancing: number
  declining: number
  unchanged: number
  noData: number
  medianMarketChange: number | null
}

export interface MarketOverviewData {
  cutoffDate: string
  breadth: MarketBreadth
  sectors: SectorSummary[]
  topGainers: UniverseCompany[]
  topLosers: UniverseCompany[]
  monitoredCoverage: {
    totalUniverse: number
    withPrice: number
    percentCovered: number
  }
}

/**
 * Builds the complete market overview from monitored companies for a specific cutoff date.
 * Rule: Only aggregates data matching the cutoff date.
 */
export function buildMarketOverview(
  companies: UniverseCompany[],
  cutoffDate: string,
): MarketOverviewData {
  // Filter companies matching cutoffDate (or having price on cutoff date)
  let advancing = 0
  let declining = 0
  let unchanged = 0
  let noData = 0
  const validChanges: number[] = []

  const dateMatchingCompanies = companies.filter((c) => {
    if (!c.date) return false
    return c.date === cutoffDate || c.date.startsWith(cutoffDate)
  })

  // If some companies don't have date or match, classify them as noData
  const activeSet = dateMatchingCompanies.length > 0 ? dateMatchingCompanies : companies

  for (const c of activeSet) {
    if (c.dailyChange === null || c.dailyChange === undefined) {
      noData++
      continue
    }
    if (c.dailyChange > 0) advancing++
    else if (c.dailyChange < 0) declining++
    else unchanged++

    validChanges.push(c.dailyChange)
  }

  const breadth: MarketBreadth = {
    cutoffDate,
    totalMonitored: activeSet.length,
    advancing,
    declining,
    unchanged,
    noData,
    medianMarketChange: calculateMedian(validChanges),
  }

  // Sector breakdown
  const sectorMap = groupCompaniesBySector(activeSet)
  const sectors: SectorSummary[] = []
  for (const [sectorName, sectorCompanies] of sectorMap.entries()) {
    sectors.push(summarizeSector(sectorName, sectorCompanies))
  }

  // Sort sectors by median change descending
  sectors.sort((a, b) => (b.medianChangeFraction ?? -999) - (a.medianChangeFraction ?? -999))

  // Top gainers and losers across all sectors
  const validCompanies = activeSet
    .filter((c) => c.dailyChange !== null && c.dailyChange !== undefined)
    .sort((a, b) => (b.dailyChange ?? 0) - (a.dailyChange ?? 0))

  const topGainers = validCompanies.slice(0, 10)
  const topLosers = [...validCompanies].reverse().slice(0, 10)

  return {
    cutoffDate,
    breadth,
    sectors,
    topGainers,
    topLosers,
    monitoredCoverage: {
      totalUniverse: companies.length,
      withPrice: validCompanies.length,
      percentCovered:
        companies.length > 0
          ? Number(((validCompanies.length / companies.length) * 100).toFixed(1))
          : 0,
    },
  }
}
