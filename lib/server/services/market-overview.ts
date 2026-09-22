import { type MarketOverviewData, buildMarketOverview } from '../../../domain/market-overview.ts'
import type { UniverseCompany } from '../../../domain/universe.ts'
import { type Result, errorResult, successResult } from '../../contracts/result.ts'
import { getOrSetCache } from '../cache.ts'
import { fetchUniverseCompanies } from '../providers/sectors.ts'

const MARKET_OVERVIEW_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function getMarketOverviewService(options?: {
  cutoffDate?: string
  forceRefresh?: boolean
}): Promise<Result<MarketOverviewData>> {
  const cutoff = options?.cutoffDate || new Date().toISOString().split('T')[0]
  const cacheKey = `market_overview:${cutoff}`

  try {
    const data = await getOrSetCache<MarketOverviewData>(
      cacheKey,
      MARKET_OVERVIEW_TTL_MS,
      async () => {
        const items = await fetchUniverseCompanies(200, { forceRefresh: options?.forceRefresh })
        const companies: UniverseCompany[] = items.map((r) => ({
          symbol: r.symbol?.replace(/\.JK$/i, '') ?? '',
          name: r.company_name ?? r.symbol ?? '',
          sector: r.sector || r.sub_sector || 'Lainnya',
          subSector: r.sub_sector,
          marketCap: r.market_cap ?? null,
          lastPrice: r.last_close_price ?? null,
          dailyChange: r.daily_close_change ?? null,
          date: r.date ?? cutoff,
        }))

        return buildMarketOverview(companies, cutoff)
      },
      { forceRefresh: options?.forceRefresh },
    )

    return successResult(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat ringkasan pasar.'
    return errorResult('PROVIDER_UNAVAILABLE', message)
  }
}
