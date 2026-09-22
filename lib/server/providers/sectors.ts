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
    const [rawComp, rawReport] = await Promise.all([
      requestSectorsShared<{
        symbol?: string
        year?: number
        data?: Array<Record<string, unknown>>
      }>(`https://api.sectors.app/v2/company/shareholders-composition/${cleanTicker}/`, {
        capabilityId: 'shareholders_composition',
        apiKey,
        fetchFn,
      }).catch(() => null),
      requestSectorsShared<Record<string, unknown>>(
        `https://api.sectors.app/v2/company/report/${cleanTicker}/?sections=ownership`,
        {
          capabilityId: 'company_report',
          params: { sections: ['ownership'] },
          apiKey,
          fetchFn,
        },
      ).catch(() => null),
    ])

    if (!rawComp && !rawReport) {
      return createEmptyEnvelope('SECTORS', null, 'Data pemegang saham tidak tersedia.')
    }

    // Extract top shareholders and public free float from ownership section
    const ownershipData = (rawReport?.ownership as Record<string, unknown>) ?? {}
    const majorShareholders = Array.isArray(ownershipData.major_shareholders)
      ? ownershipData.major_shareholders
      : []

    let publicFloatPct: number | null = null
    let publicFloatShares: number | null = null
    const topShareholders: CompanyShareholdersData['topShareholders'] = []

    for (const sh of majorShareholders) {
      if (!sh || typeof sh !== 'object') continue
      const name = String(sh.name ?? '')
      const shares = Number(sh.share_amount) || null
      const pctNum = Number(sh.share_percentage)
      const percentage = Number.isFinite(pctNum) ? Number((pctNum * 100).toFixed(2)) : null

      if (name.toLowerCase() === 'public') {
        publicFloatPct = percentage
        publicFloatShares = shares
      }

      const isController =
        name.toLowerCase() !== 'public' &&
        name.toLowerCase() !== 'treasury stock' &&
        percentage !== null &&
        percentage >= 5

      topShareholders.push({
        name,
        shares,
        percentage,
        isController,
      })
    }

    const rows = Array.isArray(rawComp?.data) ? rawComp.data : []
    const monthlyReports = rows.map((m, idx) => {
      const sharesTotal = typeof m.shares_number === 'number' ? m.shares_number : null
      const totalL = typeof m.total_l === 'number' ? m.total_l : 0
      const totalF = typeof m.total_f === 'number' ? m.total_f : 0
      const localPct = sharesTotal && sharesTotal > 0 ? (totalL / sharesTotal) * 100 : null
      const foreignPct = sharesTotal && sharesTotal > 0 ? (totalF / sharesTotal) * 100 : null

      const categories = [
        {
          code: 'ID',
          name: 'Individu',
          localShares: typeof m.individual_l === 'number' ? m.individual_l : null,
          localPct:
            sharesTotal && typeof m.individual_l === 'number'
              ? (m.individual_l / sharesTotal) * 100
              : null,
          foreignShares: typeof m.individual_f === 'number' ? m.individual_f : null,
          foreignPct:
            sharesTotal && typeof m.individual_f === 'number'
              ? (m.individual_f / sharesTotal) * 100
              : null,
          totalPct:
            sharesTotal && (typeof m.individual_l === 'number' || typeof m.individual_f === 'number')
              ? (((m.individual_l as number) || 0) + ((m.individual_f as number) || 0)) /
                sharesTotal *
                100
              : null,
        },
        {
          code: 'CP',
          name: 'Korporasi',
          localShares: typeof m.corporate_l === 'number' ? m.corporate_l : null,
          localPct:
            sharesTotal && typeof m.corporate_l === 'number'
              ? (m.corporate_l / sharesTotal) * 100
              : null,
          foreignShares: typeof m.corporate_f === 'number' ? m.corporate_f : null,
          foreignPct:
            sharesTotal && typeof m.corporate_f === 'number'
              ? (m.corporate_f / sharesTotal) * 100
              : null,
          totalPct:
            sharesTotal && (typeof m.corporate_l === 'number' || typeof m.corporate_f === 'number')
              ? (((m.corporate_l as number) || 0) + ((m.corporate_f as number) || 0)) /
                sharesTotal *
                100
              : null,
        },
        {
          code: 'MF',
          name: 'Reksa Dana',
          localShares: typeof m.mutual_fund_l === 'number' ? m.mutual_fund_l : null,
          localPct:
            sharesTotal && typeof m.mutual_fund_l === 'number'
              ? (m.mutual_fund_l / sharesTotal) * 100
              : null,
          foreignShares: typeof m.mutual_fund_f === 'number' ? m.mutual_fund_f : null,
          foreignPct:
            sharesTotal && typeof m.mutual_fund_f === 'number'
              ? (m.mutual_fund_f / sharesTotal) * 100
              : null,
          totalPct:
            sharesTotal && (typeof m.mutual_fund_l === 'number' || typeof m.mutual_fund_f === 'number')
              ? (((m.mutual_fund_l as number) || 0) + ((m.mutual_fund_f as number) || 0)) /
                sharesTotal *
                100
              : null,
        },
        {
          code: 'IS',
          name: 'Asuransi',
          localShares: typeof m.insurance_l === 'number' ? m.insurance_l : null,
          localPct:
            sharesTotal && typeof m.insurance_l === 'number'
              ? (m.insurance_l / sharesTotal) * 100
              : null,
          foreignShares: typeof m.insurance_f === 'number' ? m.insurance_f : null,
          foreignPct:
            sharesTotal && typeof m.insurance_f === 'number'
              ? (m.insurance_f / sharesTotal) * 100
              : null,
          totalPct:
            sharesTotal && (typeof m.insurance_l === 'number' || typeof m.insurance_f === 'number')
              ? (((m.insurance_l as number) || 0) + ((m.insurance_f as number) || 0)) /
                sharesTotal *
                100
              : null,
        },
        {
          code: 'PF',
          name: 'Dana Pensiun',
          localShares: typeof m.pension_fund_l === 'number' ? m.pension_fund_l : null,
          localPct:
            sharesTotal && typeof m.pension_fund_l === 'number'
              ? (m.pension_fund_l / sharesTotal) * 100
              : null,
          foreignShares: typeof m.pension_fund_f === 'number' ? m.pension_fund_f : null,
          foreignPct:
            sharesTotal && typeof m.pension_fund_f === 'number'
              ? (m.pension_fund_f / sharesTotal) * 100
              : null,
          totalPct:
            sharesTotal && (typeof m.pension_fund_l === 'number' || typeof m.pension_fund_f === 'number')
              ? (((m.pension_fund_l as number) || 0) + ((m.pension_fund_f as number) || 0)) /
                sharesTotal *
                100
              : null,
        },
        {
          code: 'IB',
          name: 'Lembaga Keuangan',
          localShares:
            typeof m.financial_institutions_l === 'number' ? m.financial_institutions_l : null,
          localPct:
            sharesTotal && typeof m.financial_institutions_l === 'number'
              ? (m.financial_institutions_l / sharesTotal) * 100
              : null,
          foreignShares:
            typeof m.financial_institutions_f === 'number' ? m.financial_institutions_f : null,
          foreignPct:
            sharesTotal && typeof m.financial_institutions_f === 'number'
              ? (m.financial_institutions_f / sharesTotal) * 100
              : null,
          totalPct:
            sharesTotal &&
            (typeof m.financial_institutions_l === 'number' ||
              typeof m.financial_institutions_f === 'number')
              ? (((m.financial_institutions_l as number) || 0) +
                  ((m.financial_institutions_f as number) || 0)) /
                sharesTotal *
                100
              : null,
        },
        {
          code: 'SC',
          name: 'Perusahaan Sekuritas',
          localShares:
            typeof m.securities_companies_l === 'number' ? m.securities_companies_l : null,
          localPct:
            sharesTotal && typeof m.securities_companies_l === 'number'
              ? (m.securities_companies_l / sharesTotal) * 100
              : null,
          foreignShares:
            typeof m.securities_companies_f === 'number' ? m.securities_companies_f : null,
          foreignPct:
            sharesTotal && typeof m.securities_companies_f === 'number'
              ? (m.securities_companies_f / sharesTotal) * 100
              : null,
          totalPct:
            sharesTotal &&
            (typeof m.securities_companies_l === 'number' ||
              typeof m.securities_companies_f === 'number')
              ? (((m.securities_companies_l as number) || 0) +
                  ((m.securities_companies_f as number) || 0)) /
                sharesTotal *
                100
              : null,
        },
        {
          code: 'FD',
          name: 'Yayasan',
          localShares: typeof m.foundation_l === 'number' ? m.foundation_l : null,
          localPct:
            sharesTotal && typeof m.foundation_l === 'number'
              ? (m.foundation_l / sharesTotal) * 100
              : null,
          foreignShares: typeof m.foundation_f === 'number' ? m.foundation_f : null,
          foreignPct:
            sharesTotal && typeof m.foundation_f === 'number'
              ? (m.foundation_f / sharesTotal) * 100
              : null,
          totalPct:
            sharesTotal &&
            (typeof m.foundation_l === 'number' || typeof m.foundation_f === 'number')
              ? (((m.foundation_l as number) || 0) + ((m.foundation_f as number) || 0)) /
                sharesTotal *
                100
              : null,
        },
        {
          code: 'OT',
          name: 'Lainnya',
          localShares: typeof m.other_l === 'number' ? m.other_l : null,
          localPct:
            sharesTotal && typeof m.other_l === 'number'
              ? (m.other_l / sharesTotal) * 100
              : null,
          foreignShares: typeof m.other_f === 'number' ? m.other_f : null,
          foreignPct:
            sharesTotal && typeof m.other_f === 'number'
              ? (m.other_f / sharesTotal) * 100
              : null,
          totalPct:
            sharesTotal &&
            (typeof m.other_l === 'number' || typeof m.other_f === 'number')
              ? (((m.other_l as number) || 0) + ((m.other_f as number) || 0)) /
                sharesTotal *
                100
              : null,
        },
      ]

      return {
        period: String(m.date ?? ''),
        totalShareholders:
          typeof m.numbers_of_shareholders === 'number' ? m.numbers_of_shareholders : null,
        totalShares: sharesTotal,
        scriptlessShares: idx === 0 ? publicFloatShares : null,
        freeFloatPct: idx === 0 ? publicFloatPct : null,
        localPct: localPct !== null ? Number(localPct.toFixed(2)) : null,
        foreignPct: foreignPct !== null ? Number(foreignPct.toFixed(2)) : null,
        categories,
      }
    })

    const data: CompanyShareholdersData = {
      symbol: cleanTicker,
      companyName: typeof rawReport?.company_name === 'string' ? rawReport.company_name : cleanTicker,
      topShareholders,
      monthlyReports,
    }

    return createEnvelope({
      state: monthlyReports.length > 0 || topShareholders.length > 0 ? 'ready' : 'empty',
      data,
      source: 'SECTORS',
      sourceDate: monthlyReports[0]?.period ?? null,
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
  const data = await getOrSetCache<UniverseCompanyRaw[]>(
    cacheKey,
    24 * 60 * 60 * 1000,
    async () => {
      const BASE_COLUMNS_WHERE = [
        '(sector is not null or sector is null)',
        '(sub_sector is not null or sub_sector is null)',
        '(last_close_price is not null or last_close_price is null)',
        '(market_cap is not null or market_cap is null)',
        '(daily_close_change is not null or daily_close_change is null)',
        '(pe_ttm is not null or pe_ttm is null)',
        '(pb_mrq is not null or pb_mrq is null)',
        '(yield_ttm is not null or yield_ttm is null)',
        '(roe_ttm is not null or roe_ttm is null)',
        '(yoy_quarter_earnings_growth is not null or yoy_quarter_earnings_growth is null)',
        '(yoy_quarter_revenue_growth is not null or yoy_quarter_revenue_growth is null)',
      ].join(' and ')

      const params = new URLSearchParams({
        limit: String(limit),
        order_by: '-market_cap',
        include_query_values: 'true',
        where: BASE_COLUMNS_WHERE,
      })

      const raw = await requestSectorsShared<{
        results?: Array<{
          symbol?: string
          company_name?: string
          query_values?: Record<string, unknown>
          [key: string]: unknown
        }>
      }>(`https://api.sectors.app/v2/companies/?${params.toString()}`, {
        capabilityId: 'companies_screener',
        params: { limit, order_by: '-market_cap' },
      })

      const items = raw?.results ?? []
      return items.map((r) => {
        const qv = r.query_values ?? {}
        return {
          symbol: r.symbol,
          company_name: r.company_name,
          sector: (qv.sector as string) ?? (r.sector as string),
          sub_sector: (qv.sub_sector as string) ?? (r.sub_sector as string),
          market_cap: typeof qv.market_cap === 'number' ? qv.market_cap : (r.market_cap as number),
          last_close_price:
            typeof qv.last_close_price === 'number'
              ? qv.last_close_price
              : (r.last_close_price as number),
          daily_close_change:
            typeof qv.daily_close_change === 'number'
              ? qv.daily_close_change
              : (r.daily_close_change as number),
          pe: typeof qv.pe_ttm === 'number' ? qv.pe_ttm : (r.pe as number),
          pb: typeof qv.pb_mrq === 'number' ? qv.pb_mrq : (r.pb as number),
          roe: typeof qv.roe_ttm === 'number' ? qv.roe_ttm : (r.roe as number),
          dividend_yield:
            typeof qv.yield_ttm === 'number' ? qv.yield_ttm : (r.dividend_yield as number),
          net_income_growth_yoy:
            typeof qv.yoy_quarter_earnings_growth === 'number'
              ? qv.yoy_quarter_earnings_growth
              : (r.net_income_growth_yoy as number),
          revenue_growth_yoy:
            typeof qv.yoy_quarter_revenue_growth === 'number'
              ? qv.yoy_quarter_revenue_growth
              : (r.revenue_growth_yoy as number),
          date: (qv.date as string) ?? (r.date as string),
        }
      })
    },
    options,
  )

  return Array.isArray(data) ? data : []
}

