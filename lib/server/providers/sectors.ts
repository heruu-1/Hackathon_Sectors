import { normalizeTicker } from '../../../domain/ticker.ts'
import {
  type BrokerRegistryEntry,
  type BrokerSummaryData,
  type CompanyValuation,
  type DailyPriceRow,
  type DataEnvelope,
  type InsiderFilingRow,
  type MarketNewsItem,
  createEmptyEnvelope,
  createEnvelope,
  createErrorEnvelope,
} from '../../contracts/market.ts'
import { SectorsProviderError, requestSectorsShared } from './transport.ts'

export { SectorsProviderError }

export async function fetchCompanyValuation(
  ticker: string,
  apiKey?: string,
  fetchFn: typeof fetch = fetch,
): Promise<DataEnvelope<CompanyValuation>> {
  const cleanTicker = normalizeTicker(ticker)
  try {
    const raw = await requestSectorsShared<Record<string, unknown>>(
      `https://api.sectors.app/v2/company/report/${cleanTicker}/?sections=valuation`,
      {
        capabilityId: 'company_report',
        params: { sections: ['valuation'] },
        apiKey,
        fetchFn,
      },
    )

    if (!raw || typeof raw !== 'object') {
      return createErrorEnvelope('SECTORS', 'Respons data valuasi rusak.')
    }

    const valuation = (raw.valuation ?? {}) as Record<string, unknown>
    const histRaw = Array.isArray(valuation.historical_valuation)
      ? valuation.historical_valuation
      : []

    const historicalValuation = histRaw.map((h: Record<string, unknown>) => ({
      year: Number(h.year),
      pe: Number.isFinite(Number(h.pe)) ? Number(h.pe) : null,
      pb: Number.isFinite(Number(h.pb)) ? Number(h.pb) : null,
    }))

    const data: CompanyValuation = {
      symbol: cleanTicker,
      companyName: typeof raw.company_name === 'string' ? raw.company_name : cleanTicker,
      lastClosePrice: Number.isFinite(Number(valuation.last_close_price))
        ? Number(valuation.last_close_price)
        : null,
      latestCloseDate:
        typeof valuation.latest_close_date === 'string' ? valuation.latest_close_date : null,
      dailyCloseChange: Number.isFinite(Number(valuation.daily_close_change))
        ? Number(valuation.daily_close_change)
        : null,
      historicalValuation,
    }

    const state = historicalValuation.length > 0 ? 'ready' : 'partial'
    return createEnvelope({
      state,
      data,
      source: 'SECTORS',
      sourceDate: data.latestCloseDate,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat valuasi perusahaan.'
    return createErrorEnvelope('SECTORS', message)
  }
}

export async function fetchDailyPrices(
  ticker: string,
  apiKey?: string,
  daysBack = 90,
  fetchFn: typeof fetch = fetch,
): Promise<DataEnvelope<DailyPriceRow[]>> {
  const cleanTicker = normalizeTicker(ticker)
  try {
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - daysBack * 86_400_000).toISOString().split('T')[0]

    const raw = await requestSectorsShared<unknown>(
      `https://api.sectors.app/v2/daily/${cleanTicker}/?start=${startDate}&end=${endDate}`,
      {
        capabilityId: 'daily_price',
        apiKey,
        fetchFn,
      },
    )

    if (!Array.isArray(raw)) {
      return createEmptyEnvelope('SECTORS', endDate, 'Tidak ada data harga harian.')
    }

    const rows: DailyPriceRow[] = raw
      .map((r: Record<string, unknown>) => ({
        symbol: cleanTicker,
        date: String(r.date ?? ''),
        close: Number(r.close ?? 0),
        open: r.open != null && Number.isFinite(Number(r.open)) ? Number(r.open) : null,
        high: r.high != null && Number.isFinite(Number(r.high)) ? Number(r.high) : null,
        low: r.low != null && Number.isFinite(Number(r.low)) ? Number(r.low) : null,
        volume: Number(r.volume ?? 0),
        marketCap: Number.isFinite(Number(r.market_cap)) ? Number(r.market_cap) : null,
      }))
      .filter((r) => r.date && Number.isFinite(r.close))

    if (rows.length === 0) {
      return createEmptyEnvelope('SECTORS', endDate, 'Data harga harian kosong.')
    }

    return createEnvelope({
      state: rows.length >= 21 ? 'ready' : 'partial',
      data: rows,
      source: 'SECTORS',
      periodStart: startDate,
      periodEnd: endDate,
      sourceDate: rows[rows.length - 1]?.date ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat harga harian.'
    return createErrorEnvelope('SECTORS', message)
  }
}

export async function fetchBrokerSummary(
  ticker: string,
  apiKey?: string,
  daysBack = 10,
  fetchFn: typeof fetch = fetch,
): Promise<DataEnvelope<BrokerSummaryData>> {
  const cleanTicker = normalizeTicker(ticker)
  try {
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - daysBack * 86_400_000).toISOString().split('T')[0]

    const raw = await requestSectorsShared<Record<string, unknown>>(
      `https://api.sectors.app/v2/broker-summary/${cleanTicker}/?start=${startDate}&end=${endDate}`,
      {
        capabilityId: 'broker_summary',
        apiKey,
        fetchFn,
      },
    )

    if (!raw || !Array.isArray(raw.data)) {
      return createEmptyEnvelope('SECTORS', endDate, 'Data broker summary kosong.')
    }

    const data: BrokerSummaryData = {
      symbol: cleanTicker,
      data: raw.data as BrokerSummaryData['data'],
    }

    return createEnvelope({
      state: data.data.length > 0 ? 'ready' : 'empty',
      data,
      source: 'SECTORS',
      periodStart: startDate,
      periodEnd: endDate,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat broker summary.'
    return createErrorEnvelope('SECTORS', message)
  }
}

export async function fetchBrokersRegistry(
  apiKey?: string,
  fetchFn: typeof fetch = fetch,
): Promise<DataEnvelope<Record<string, BrokerRegistryEntry>>> {
  try {
    const raw = await requestSectorsShared<unknown>('https://api.sectors.app/v2/brokers/', {
      capabilityId: 'brokers_registry',
      apiKey,
      fetchFn,
    })

    if (!Array.isArray(raw)) {
      return createEmptyEnvelope('SECTORS', null, 'Registry broker kosong.')
    }

    const registry: Record<string, BrokerRegistryEntry> = {}
    for (const item of raw) {
      if (item && typeof item.code === 'string') {
        const code = item.code.toUpperCase()
        registry[code] = {
          code,
          name: typeof item.name === 'string' ? item.name : code,
          is_foreign: Boolean(item.is_foreign),
          cohort: item.cohort ?? 'unknown',
        }
      }
    }

    return createEnvelope({
      state: 'ready',
      data: registry,
      source: 'SECTORS',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat registry broker.'
    return createErrorEnvelope('SECTORS', message)
  }
}

export async function fetchMarketNews(
  ticker?: string,
  apiKey?: string,
  limit = 5,
  fetchFn: typeof fetch = fetch,
): Promise<DataEnvelope<MarketNewsItem[]>> {
  try {
    const cleanTicker = ticker ? normalizeTicker(ticker) : undefined
    const param = cleanTicker
      ? `symbols=${cleanTicker}&limit=${limit}`
      : `extension=idx&limit=${limit}`

    const raw = await requestSectorsShared<{ results?: MarketNewsItem[] }>(
      `https://api.sectors.app/v2/news/?${param}`,
      {
        capabilityId: 'market_news',
        apiKey,
        fetchFn,
      },
    )

    const results = raw?.results ?? []
    if (results.length === 0) {
      return createEmptyEnvelope('SECTORS', null, 'Tidak ada berita terkini.')
    }

    return createEnvelope({
      state: 'ready',
      data: results,
      source: 'SECTORS',
      sourceDate: results[0]?.timestamp ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat berita pasar.'
    return createErrorEnvelope('SECTORS', message)
  }
}

export async function fetchInsiderFilings(
  ticker?: string,
  apiKey?: string,
  limit = 5,
  fetchFn: typeof fetch = fetch,
): Promise<DataEnvelope<InsiderFilingRow[]>> {
  try {
    const cleanTicker = ticker ? normalizeTicker(ticker) : undefined
    const param = cleanTicker ? `symbol=${cleanTicker}&limit=${limit}` : `limit=${limit}`

    const raw = await requestSectorsShared<{ results?: InsiderFilingRow[] }>(
      `https://api.sectors.app/v2/filings/?${param}`,
      {
        capabilityId: 'filings',
        apiKey,
        fetchFn,
      },
    )

    const results = raw?.results ?? []
    if (results.length === 0) {
      return createEmptyEnvelope('SECTORS', null, 'Tidak ada pelaporan orang dalam terbaru.')
    }

    return createEnvelope({
      state: 'ready',
      data: results,
      source: 'SECTORS',
      sourceDate: results[0]?.timestamp ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat pelaporan orang dalam.'
    return createErrorEnvelope('SECTORS', message)
  }
}

export interface CompanyShareholdersData {
  symbol: string
  companyName: string
  topShareholders: Array<{
    name: string
    shares: number | null
    percentage: number | null
    isController?: boolean
  }>
  monthlyReports: Array<{
    period: string
    totalShareholders: number | null
    totalShares: number | null
    scriptlessShares: number | null
    freeFloatPct: number | null
    localPct: number | null
    foreignPct: number | null
    categories?: Array<{
      code: string
      name: string
      localShares: number | null
      localPct: number | null
      foreignShares: number | null
      foreignPct: number | null
      totalPct: number | null
    }>
  }>
}

export async function fetchCompanyShareholders(
  ticker: string,
  apiKey?: string,
  fetchFn: typeof fetch = fetch,
): Promise<DataEnvelope<CompanyShareholdersData>> {
  const cleanTicker = normalizeTicker(ticker)
  try {
    const raw = await requestSectorsShared<Record<string, unknown>>(
      `https://api.sectors.app/v2/company/report/${cleanTicker}/?sections=shareholders`,
      {
        capabilityId: 'shareholders_composition',
        apiKey,
        fetchFn,
      },
    )

    if (!raw || typeof raw !== 'object') {
      return createEmptyEnvelope('SECTORS', null, 'Data pemegang saham tidak tersedia.')
    }

    const sh = (raw.shareholders as Record<string, unknown>) ?? {}
    const topRaw = Array.isArray(sh.top) ? (sh.top as Array<Record<string, unknown>>) : []
    const monthlyRaw = Array.isArray(sh.monthly)
      ? (sh.monthly as Array<Record<string, unknown>>)
      : []

    const topShareholders = topRaw.map((item) => ({
      name: String(item.name ?? item.shareholder_name ?? 'Pemegang Saham'),
      shares: typeof item.shares === 'number' ? item.shares : null,
      percentage: typeof item.percentage === 'number' ? item.percentage : null,
      isController: Boolean(item.is_controller || item.is_controlling),
    }))

    const monthlyReports = monthlyRaw.map((m) => ({
      period: String(m.period ?? m.month ?? ''),
      totalShareholders: typeof m.total_shareholders === 'number' ? m.total_shareholders : null,
      totalShares: typeof m.total_shares === 'number' ? m.total_shares : null,
      scriptlessShares: typeof m.scriptless_shares === 'number' ? m.scriptless_shares : null,
      freeFloatPct:
        typeof m.free_float === 'number'
          ? m.free_float
          : typeof m.free_float_pct === 'number'
            ? m.free_float_pct
            : null,
      localPct:
        typeof m.local === 'number'
          ? m.local
          : typeof m.local_pct === 'number'
            ? m.local_pct
            : null,
      foreignPct:
        typeof m.foreign === 'number'
          ? m.foreign
          : typeof m.foreign_pct === 'number'
            ? m.foreign_pct
            : null,
      categories: Array.isArray(m.categories) ? m.categories : [],
    }))

    const data: CompanyShareholdersData = {
      symbol: cleanTicker,
      companyName: typeof raw.company_name === 'string' ? raw.company_name : cleanTicker,
      topShareholders,
      monthlyReports,
    }

    return createEnvelope({
      state: topShareholders.length > 0 || monthlyReports.length > 0 ? 'ready' : 'empty',
      data,
      source: 'SECTORS',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat data pemegang saham.'
    return createErrorEnvelope('SECTORS', message)
  }
}

export interface UniverseCompanyRaw {
  symbol?: string
  company_name?: string
  sector?: string
  sub_sector?: string
  market_cap?: number
  last_close_price?: number
  daily_close_change?: number
  date?: string
  pe?: number
  pb?: number
  roe?: number
  dividend_yield?: number
  net_income_growth_yoy?: number
  revenue_growth_yoy?: number
  [key: string]: unknown
}

export async function fetchUniverseCompanies(
  limit = 200,
  options?: { forceRefresh?: boolean },
): Promise<UniverseCompanyRaw[]> {
  const { getOrSetCache } = await import('../cache.ts')
  const cacheKey = `sectors:universe:companies:${limit}`
  const data = await getOrSetCache<{ results?: UniverseCompanyRaw[] } | UniverseCompanyRaw[]>(
    cacheKey,
    24 * 60 * 60 * 1000,
    async () => {
      return await requestSectorsShared<{ results?: UniverseCompanyRaw[] }>(
        `https://api.sectors.app/v2/companies/?limit=${limit}&order_by=-market_cap`,
        {
          capabilityId: 'companies_screener',
          params: { limit, order_by: '-market_cap' },
        },
      )
    },
    options,
  )

  if (Array.isArray(data)) {
    return data
  }
  return data?.results ?? []
}

