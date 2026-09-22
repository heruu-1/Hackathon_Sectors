import { analyzeBandarmology } from '../../../domain/bandarmology.ts'
import {
  type BusinessExposureAnalysis,
  analyzeBusinessExposure,
} from '../../../domain/business-exposure.ts'
import { detectCatalystDivergence } from '../../../domain/divergence.ts'
import {
  type FundamentalAnalysisResult,
  analyzeFundamentals,
} from '../../../domain/fundamentals.ts'
import { analyzeInsiderMovement } from '../../../domain/insider.ts'
import { type OwnershipAnalysisResult, analyzeOwnership } from '../../../domain/ownership.ts'
import {
  type PeerComparisonResult,
  type PeerValuationInput,
  compareTargetWithPeers,
} from '../../../domain/peer-comparison.ts'
import { computeCompositeScore, evaluateFundamentals } from '../../../domain/scoring.ts'
import { normalizeTicker } from '../../../domain/ticker.ts'
import { calculateVolumeSpike } from '../../../domain/volume.ts'
import {
  type AnalysisSnapshot,
  RASI_RULE_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
} from '../../contracts/analysis.ts'
import type {
  BrokerRegistryEntry,
  BrokerSummaryData,
  CompanyValuation,
  DailyPriceRow,
  DataEnvelope,
  InsiderFilingRow,
  MarketNewsItem,
} from '../../contracts/market.ts'
import { type Result, errorResult, successResult } from '../../contracts/result.ts'
import { TickerSchema } from '../../contracts/watchlist.ts'
import { getOrSetCache } from '../cache.ts'
import { withIdempotency } from '../idempotency.ts'
import { analyzeNewsImpact, fallbackAnalyzeNews } from '../providers/gemini.ts'
import { type RawQuarterlyFinancial, fetchQuarterlyFinancials } from '../providers/quarterly.ts'
import {
  type CompanyShareholdersData,
  fetchBrokerSummary,
  fetchBrokersRegistry,
  fetchCompanyShareholders,
  fetchCompanyValuation,
  fetchDailyPrices,
  fetchInsiderFilings,
  fetchMarketNews,
  fetchUniverseCompanies,
} from '../providers/sectors.ts'
import { type CompanySegmentsData, fetchCompanySegments } from '../providers/segments.ts'
import { requestSectorsShared } from '../providers/transport.ts'
import { consumeQuota } from '../quota.ts'
import { addHistoryEntry } from '../repositories/history.ts'
import { getLatestSnapshotByTicker, insertSnapshot } from '../repositories/snapshots.ts'

export interface StockDataResult {
  ticker: string
  companyName: string
  price: number | null
  priceChangeFraction: number | null
  priceDate: string | null
  envelopes: {
    valuation: DataEnvelope<CompanyValuation>
    daily: DataEnvelope<DailyPriceRow[]>
    broker: DataEnvelope<BrokerSummaryData>
    registry: DataEnvelope<Record<string, BrokerRegistryEntry>>
    news: DataEnvelope<MarketNewsItem[]>
    filings: DataEnvelope<InsiderFilingRow[]>
    quarterly?: DataEnvelope<RawQuarterlyFinancial[]>
    shareholders?: DataEnvelope<CompanyShareholdersData>
    segments?: DataEnvelope<CompanySegmentsData>
  }
  indicators: AnalysisSnapshot['indicators']
  composite: AnalysisSnapshot['composite']
  fundamentals?: FundamentalAnalysisResult | null
  peerComparison?: PeerComparisonResult | null
  ownership?: OwnershipAnalysisResult | null
  businessExposure?: BusinessExposureAnalysis | null
}

/**
 * Reads market data and computes indicators using cache.
 * Does NOT call Gemini, does NOT write to database, and does NOT consume user quota.
 * Safe for view-only pages, comparisons, and exploratory research.
 */
export async function readStockData(
  ticker: string,
  options?: { forceRefresh?: boolean },
): Promise<StockDataResult> {
  const cleanTicker = normalizeTicker(ticker)

  // Fetch cached market data concurrently
  const [
    valuation,
    daily,
    broker,
    registry,
    news,
    filings,
    quarterly,
    shareholders,
    segments,
    screener,
  ] = await Promise.all([
    getOrSetCache(
      `sectors:valuation:${cleanTicker}`,
      3600_000,
      () => fetchCompanyValuation(cleanTicker),
      options,
    ),
    getOrSetCache(
      `sectors:daily:90:${cleanTicker}`,
      900_000,
      () => fetchDailyPrices(cleanTicker, undefined, 90),
      options,
    ),
    getOrSetCache(
      `sectors:broker:${cleanTicker}`,
      900_000,
      () => fetchBrokerSummary(cleanTicker, undefined, 10),
      options,
    ),
    getOrSetCache('sectors:registry', 86_400_000, () => fetchBrokersRegistry()),
    getOrSetCache(
      `sectors:news:${cleanTicker}`,
      600_000,
      () => fetchMarketNews(cleanTicker, undefined, 5),
      options,
    ),
    getOrSetCache(
      `sectors:filings:${cleanTicker}`,
      3600_000,
      () => fetchInsiderFilings(cleanTicker, undefined, 5),
      options,
    ),
    getOrSetCache(
      `sectors:quarterly:${cleanTicker}`,
      86_400_000,
      () => fetchQuarterlyFinancials(cleanTicker),
      options,
    ),
    getOrSetCache(
      `sectors:shareholders:${cleanTicker}`,
      86_400_000,
      () => fetchCompanyShareholders(cleanTicker),
      options,
    ),
    getOrSetCache(
      `sectors:segments:${cleanTicker}`,
      86_400_000,
      () => fetchCompanySegments(cleanTicker),
      options,
    ),
    fetchUniverseCompanies(200, options).catch(() => []),
  ])

  // Extract reference price and change
  const currentPrice =
    valuation.data?.lastClosePrice ??
    (daily.data && daily.data.length > 0 ? daily.data[daily.data.length - 1].close : null)

  const priceChangeFraction =
    valuation.data?.dailyCloseChange ??
    (daily.data && daily.data.length >= 2
      ? (daily.data[daily.data.length - 1].close - daily.data[daily.data.length - 2].close) /
        daily.data[daily.data.length - 2].close
      : null)

  const priceDate =
    valuation.data?.latestCloseDate ??
    (daily.data && daily.data.length > 0 ? daily.data[daily.data.length - 1].date : null)

  // Screener & Peer mapping
  const screenerItems = Array.isArray(screener)
    ? screener
    : (((screener as { results?: unknown[] } | null)?.results as Record<string, unknown>[]) ?? [])

  const candidatePeers: PeerValuationInput[] = screenerItems.map((c: Record<string, unknown>) => ({
    symbol: String(c.symbol ?? ''),
    sector: typeof c.sector === 'string' ? c.sector : undefined,
    sub_sector: typeof c.sub_sector === 'string' ? c.sub_sector : undefined,
    market_cap: typeof c.market_cap === 'number' ? c.market_cap : null,
    pe: typeof c.pe === 'number' ? c.pe : null,
    pb: typeof c.pb === 'number' ? c.pb : null,
    roe: typeof c.roe === 'number' ? c.roe : null,
    dividend_yield: typeof c.dividend_yield === 'number' ? c.dividend_yield : null,
    net_income_growth_yoy:
      typeof c.net_income_growth_yoy === 'number' ? c.net_income_growth_yoy : null,
    revenue_growth_yoy: typeof c.revenue_growth_yoy === 'number' ? c.revenue_growth_yoy : null,
  }))

  const targetInScreener = candidatePeers.find((c) => normalizeTicker(c.symbol) === cleanTicker)
  const targetSector = targetInScreener?.sector
  const targetSubSector = targetInScreener?.sub_sector

  // Compute indicators & domain analyses
  const fundamental = evaluateFundamentals(valuation.data)
  const fundamentals = analyzeFundamentals(quarterly?.data ?? [], targetSector, targetSubSector)

  const targetPeerInput: PeerValuationInput = {
    symbol: cleanTicker,
    sector: targetSector,
    sub_sector: targetSubSector,
    market_cap: targetInScreener?.market_cap ?? null,
    pe: valuation.data?.historicalValuation?.[0]?.pe ?? targetInScreener?.pe ?? null,
    pb: valuation.data?.historicalValuation?.[0]?.pb ?? targetInScreener?.pb ?? null,
    roe: targetInScreener?.roe ?? null,
    dividend_yield: targetInScreener?.dividend_yield ?? null,
    net_income_growth_yoy:
      fundamentals && 'netIncomeGrowth' in fundamentals
        ? fundamentals.netIncomeGrowth.growthFraction
        : (targetInScreener?.net_income_growth_yoy ?? null),
    revenue_growth_yoy:
      fundamentals && 'revenueGrowth' in fundamentals
        ? fundamentals.revenueGrowth.growthFraction
        : (targetInScreener?.revenue_growth_yoy ?? null),
  }

  const peerComparison = compareTargetWithPeers(targetPeerInput, candidatePeers)

  const ownership = analyzeOwnership(
    cleanTicker,
    shareholders?.data?.topShareholders ?? [],
    shareholders?.data?.monthlyReports ?? [],
    filings.data ?? [],
    currentPrice,
  )

  const businessExposure = analyzeBusinessExposure(
    cleanTicker,
    valuation.data?.companyName || cleanTicker,
    segments?.data?.revenueSegments ?? [],
  )

  const volume = calculateVolumeSpike(daily.data ?? [])
  const latestBrokerSummary = broker.data?.data?.[0]?.summary ?? []
  const brokerDate = broker.data?.data?.[0]?.date ?? broker.sourceDate
  const bandarmology = analyzeBandarmology(
    latestBrokerSummary,
    registry.data ?? {},
    currentPrice,
    brokerDate,
  )

  // News divergence for view-only: use rule-based fallback without calling Gemini API
  const latestNews = news.data && news.data.length > 0 ? news.data[0] : null
  const newsImpact = latestNews
    ? fallbackAnalyzeNews(latestNews.title, latestNews.body ?? latestNews.title)
    : null
  const latestNewsUrl = latestNews?.source?.startsWith('http')
    ? latestNews.source
    : (((latestNews as unknown as Record<string, unknown>)?.url as string | null) ?? null)

  const divergence = detectCatalystDivergence(
    newsImpact,
    priceChangeFraction,
    latestNews?.timestamp ?? null,
    latestNewsUrl,
  )
  const insider = analyzeInsiderMovement(filings.data, currentPrice)
  const composite = computeCompositeScore({ fundamental, bandarmology, divergence, insider })

  return {
    ticker: cleanTicker,
    companyName: valuation.data?.companyName || cleanTicker,
    price: currentPrice,
    priceChangeFraction,
    priceDate,
    envelopes: {
      valuation,
      daily,
      broker,
      registry,
      news,
      filings,
      quarterly,
      shareholders,
      segments,
    },
    indicators: {
      fundamental,
      bandarmology,
      volume,
      divergence,
      insider,
    },
    composite,
    fundamentals,
    peerComparison,
    ownership,
    businessExposure,
  }
}

/**
 * Reads the latest saved analysis snapshot for a ticker from the database.
 * Does NOT call Gemini and does NOT insert into the database.
 */
export async function readLatestAnalysis(ticker: string): Promise<AnalysisSnapshot | null> {
  const cleanTicker = normalizeTicker(ticker)
  return getLatestSnapshotByTicker(cleanTicker)
}

export interface CreateAnalysisInput {
  ticker: string
  requestKey: string
  userId: string
}

/**
 * Creates a complete analysis snapshot with fresh data and Gemini AI news analysis.
 * Requires user authentication, consumes user analysis quota, and saves to database.
 * Deduplicated via requestKey idempotency.
 */
export async function createAnalysis(
  input: CreateAnalysisInput,
): Promise<Result<AnalysisSnapshot>> {
  if (!input.userId) {
    return errorResult('AUTH_REQUIRED', 'Anda harus masuk untuk membuat analisis.')
  }

  const tickerParse = TickerSchema.safeParse(input.ticker)
  if (!tickerParse.success) {
    return errorResult('VALIDATION_ERROR', 'Kode saham harus berupa 4 huruf IDX.')
  }
  const cleanTicker = tickerParse.data

  if (!input.requestKey || typeof input.requestKey !== 'string') {
    return errorResult('VALIDATION_ERROR', 'Request key harus disertakan.')
  }

  return withIdempotency(input.userId, 'analysis', input.requestKey, async () => {
    // 1. Consume user quota
    const quotaResult = await consumeQuota(input.userId, 'analysis')
    if (!quotaResult.ok) {
      return quotaResult
    }

    // 2. Fetch fresh market data from Sectors
    const [valuation, daily, broker, registry, news, filings] = await Promise.all([
      fetchCompanyValuation(cleanTicker),
      fetchDailyPrices(cleanTicker, undefined, 90),
      fetchBrokerSummary(cleanTicker, undefined, 10),
      fetchBrokersRegistry(),
      fetchMarketNews(cleanTicker, undefined, 5),
      fetchInsiderFilings(cleanTicker, undefined, 5),
    ])

    // 3. Extract price & date
    const currentPrice =
      valuation.data?.lastClosePrice ??
      (daily.data && daily.data.length > 0 ? daily.data[daily.data.length - 1].close : null)

    const priceChangeFraction =
      valuation.data?.dailyCloseChange ??
      (daily.data && daily.data.length >= 2
        ? (daily.data[daily.data.length - 1].close - daily.data[daily.data.length - 2].close) /
          daily.data[daily.data.length - 2].close
        : null)

    const priceDate =
      valuation.data?.latestCloseDate ??
      (daily.data && daily.data.length > 0 ? daily.data[daily.data.length - 1].date : null)

    // 4. Run Gemini news impact analysis on latest news item
    const latestNews = news.data && news.data.length > 0 ? news.data[0] : null
    let newsImpact = null
    if (latestNews) {
      newsImpact = await analyzeNewsImpact(
        latestNews.title,
        latestNews.body ?? latestNews.title,
        cleanTicker,
      )
    }

    // 5. Compute indicators using pure domain rules
    const fundamental = evaluateFundamentals(valuation.data)
    const volume = calculateVolumeSpike(daily.data ?? [])
    const latestBrokerSummary = broker.data?.data?.[0]?.summary ?? []
    const brokerDate = broker.data?.data?.[0]?.date ?? broker.sourceDate
    const bandarmology = analyzeBandarmology(
      latestBrokerSummary,
      registry.data ?? {},
      currentPrice,
      brokerDate,
    )
    const latestNewsUrl = latestNews?.source?.startsWith('http')
      ? latestNews.source
      : (((latestNews as unknown as Record<string, unknown>)?.url as string | null) ?? null)
    const divergence = detectCatalystDivergence(
      newsImpact,
      priceChangeFraction,
      latestNews?.timestamp ?? null,
      latestNewsUrl,
    )
    const insider = analyzeInsiderMovement(filings.data, currentPrice)
    const composite = computeCompositeScore({ fundamental, bandarmology, divergence, insider })

    // 6. Assemble AnalysisSnapshot
    const snapshotId = crypto.randomUUID()
    const nowIso = new Date().toISOString()

    const snapshot: AnalysisSnapshot = {
      id: snapshotId,
      ticker: cleanTicker,
      companyName: valuation.data?.companyName || cleanTicker,
      createdAt: nowIso,
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      ruleVersion: RASI_RULE_VERSION,
      price: currentPrice,
      priceChangeFraction,
      priceDate,
      envelopes: {
        valuation,
        daily,
        broker,
        news,
        filings,
      },
      indicators: {
        fundamental,
        bandarmology,
        volume,
        divergence,
        insider,
      },
      composite,
      provenance: {
        newsAnalysis: newsImpact?.analysisSource ?? 'UNAVAILABLE',
        model: newsImpact?.model,
      },
    }

    // 7. Persist snapshot and record user history
    await insertSnapshot(snapshot)
    await addHistoryEntry(input.userId, snapshot.id, snapshot.ticker)

    return successResult(snapshot)
  })
}
