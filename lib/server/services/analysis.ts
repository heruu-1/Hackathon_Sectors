import { analyzeBandarmology } from '../../../domain/bandarmology.ts'
import { detectCatalystDivergence } from '../../../domain/divergence.ts'
import { analyzeInsiderMovement } from '../../../domain/insider.ts'
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
import {
  fetchBrokerSummary,
  fetchBrokersRegistry,
  fetchCompanyValuation,
  fetchDailyPrices,
  fetchInsiderFilings,
  fetchMarketNews,
} from '../providers/sectors.ts'
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
  }
  indicators: AnalysisSnapshot['indicators']
  composite: AnalysisSnapshot['composite']
}

/**
 * Reads market data and computes indicators using cache.
 * Does NOT call Gemini, does NOT write to database, and does NOT consume user quota.
 * Safe for view-only pages, comparisons, and exploratory research.
 */
export async function readStockData(ticker: string): Promise<StockDataResult> {
  const cleanTicker = normalizeTicker(ticker)

  // Fetch cached market data concurrently
  const [valuation, daily, broker, registry, news, filings] = await Promise.all([
    getOrSetCache(`sectors:valuation:${cleanTicker}`, 3600_000, () =>
      fetchCompanyValuation(cleanTicker),
    ),
    getOrSetCache(`sectors:daily:${cleanTicker}`, 900_000, () =>
      fetchDailyPrices(cleanTicker, undefined, 30),
    ),
    getOrSetCache(`sectors:broker:${cleanTicker}`, 900_000, () =>
      fetchBrokerSummary(cleanTicker, undefined, 10),
    ),
    getOrSetCache('sectors:registry', 86_400_000, () => fetchBrokersRegistry()),
    getOrSetCache(`sectors:news:${cleanTicker}`, 600_000, () =>
      fetchMarketNews(cleanTicker, undefined, 5),
    ),
    getOrSetCache(`sectors:filings:${cleanTicker}`, 3600_000, () =>
      fetchInsiderFilings(cleanTicker, undefined, 5),
    ),
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

  // Compute indicators
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

  // News divergence for view-only: use rule-based fallback without calling Gemini API
  const latestNews = news.data && news.data.length > 0 ? news.data[0] : null
  const newsImpact = latestNews
    ? fallbackAnalyzeNews(latestNews.title, latestNews.body ?? latestNews.title)
    : null

  const divergence = detectCatalystDivergence(
    newsImpact,
    priceChangeFraction,
    latestNews?.timestamp ?? null,
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
    },
    indicators: {
      fundamental,
      bandarmology,
      volume,
      divergence,
      insider,
    },
    composite,
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
      fetchDailyPrices(cleanTicker, undefined, 30),
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
    const divergence = detectCatalystDivergence(
      newsImpact,
      priceChangeFraction,
      latestNews?.timestamp ?? null,
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
