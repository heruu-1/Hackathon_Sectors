'use server'

import type { Anomaly } from '@/db/schema'
import type { BandarmologyAnalysis } from '@/lib/bandarmology'
import type { AnalysisSnapshot } from '@/lib/contracts/analysis'
import type { CatalystDivergence } from '@/lib/divergence'
import type { GeminiNewsImpact } from '@/lib/gemini'
import type { InsiderMovementAnalysis } from '@/lib/insider'
import {
  SectorsError,
  buildFullIntelligence,
  fetchBrokerSummary,
  fetchBrokersRegistry,
  fetchCompanyReport,
  fetchDailyTransactions,
  fetchInsiderFilings,
  fetchMarketNews,
  normalizeTicker,
} from '@/lib/sectors'
import { getOrSetCache } from '@/lib/server/cache'
import { analyzeNewsImpact } from '@/lib/server/providers/gemini'
import { getRecentPublicSnapshots } from '@/lib/server/repositories/snapshots'
import {
  type StockDataResult,
  createAnalysis,
  readLatestAnalysis,
  readStockData,
} from '@/lib/server/services/analysis'

import { getCurrentUserId } from './shared'

/**
 * Reads stock market data and computed indicators via cache.
 * Does NOT call Gemini, does NOT write to database, and does NOT consume user quota.
 * Safe for view-only pages, comparisons, and exploratory research.
 */
export async function getStockData(
  ticker: string,
  options?: { forceRefresh?: boolean },
): Promise<{ success: boolean; data?: StockDataResult; error?: string }> {
  try {
    const data = await readStockData(ticker, options)
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat data saham.',
    }
  }
}

/**
 * Creates an analysis snapshot with fresh data and Gemini AI news analysis.
 * Requires user authentication, consumes user analysis quota, and saves to database.
 */
export async function createAnalysisAction(
  ticker: string,
  requestKey?: string,
): Promise<{ success: boolean; data?: AnalysisSnapshot; error?: string }> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk membuat analisis baru.',
    }
  }

  const key = requestKey || crypto.randomUUID()
  const result = await createAnalysis({ ticker, requestKey: key, userId })
  if (!result.ok) {
    return { success: false, error: result.error.message }
  }
  return { success: true, data: result.data }
}

/**
 * Reads the latest available public snapshot for a ticker without triggering a new analysis.
 */
export async function getLatestAnalysisAction(
  ticker: string,
): Promise<{ success: boolean; data?: AnalysisSnapshot | null; error?: string }> {
  try {
    const data = await readLatestAnalysis(ticker)
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal membaca snapshot analisis.',
    }
  }
}

/**
 * Reads recent public snapshots from the database.
 */
export async function getRecentPublicSnapshotsAction(
  limit = 20,
): Promise<{ success: boolean; data?: AnalysisSnapshot[]; error?: string }> {
  try {
    const data = await getRecentPublicSnapshots(limit)
    return { success: true, data }
  } catch {
    return { success: false, error: 'Gagal memuat riwayat analisis publik.' }
  }
}

/**
 * Backward-compatible analyzeTicker function that computes intelligence WITHOUT
 * inserting into the database on read! (F04 resolved)
 */
export async function analyzeTicker(ticker: string) {
  try {
    const cleanTicker = normalizeTicker(ticker)
    const apiKey = process.env.SECTORS_API_KEY

    // Fetch data concurrently (cached)
    const [reportData, dailyRows, brokerData, brokerRegistry, newsItems, filings] =
      await Promise.all([
        fetchCompanyReport(cleanTicker, apiKey),
        fetchDailyTransactions(cleanTicker, apiKey).catch(() => []),
        fetchBrokerSummary(cleanTicker, apiKey).catch(() => ({ symbol: cleanTicker, data: [] })),
        fetchBrokersRegistry(apiKey).catch(() => ({})),
        fetchMarketNews(cleanTicker, apiKey, 3).catch(() => []),
        fetchInsiderFilings(cleanTicker, apiKey, 3).catch(() => []),
      ])

    // Analyze News with rule-based / Gemini provider
    let newsImpact = null
    if (newsItems.length > 0) {
      const topNews = newsItems[0]
      newsImpact = await analyzeNewsImpact(topNews.title, topNews.body, cleanTicker)
    }

    // Build unified 4-pillar intelligence (pure function)
    const intelligence = buildFullIntelligence({
      ticker: cleanTicker,
      reportData,
      dailyRows,
      brokerData,
      brokerRegistry,
      newsItems,
      newsImpact: newsImpact as unknown as GeminiNewsImpact | null,
      filings,
    })

    // Return the calculated intelligence object directly without database insert
    const anomalyData = {
      id: 0,
      umaId: `UMA-${cleanTicker}`,
      ticker: intelligence.ticker,
      name: intelligence.name,
      risk: intelligence.risk,
      price: intelligence.price,
      change: intelligence.change,
      priceDate: intelligence.priceDate,
      rawPrice: intelligence.rawPrice,
      rawChange: intelligence.rawChange,
      volumeSpike: intelligence.volumeSpike,
      volumeSpikeRatio: intelligence.volumeSpikeRatio,
      status: intelligence.status,
      compositeScore: intelligence.compositeScore,
      reason: intelligence.reason,
      bandarmology: intelligence.bandarmology,
      catalystDivergence: intelligence.catalystDivergence,
      insiderMovement: intelligence.insiderMovement,
      newsImpact: intelligence.newsImpact,
      createdAt: new Date(),
    }

    return { success: true, data: anomalyData }
  } catch (error) {
    return {
      error:
        error instanceof SectorsError
          ? error.message
          : 'Data saham belum dapat dimuat. Pastikan koneksi atau periksa kode saham.',
    }
  }
}

export async function getRecentAnomalies(): Promise<{
  success?: boolean
  data?: Anomaly[]
  error?: string
}> {
  try {
    const { db } = await import('@/db')
    const { analysisSnapshots } = await import('@/db/schema')
    const { desc } = await import('drizzle-orm')

    const rows = await db
      .select()
      .from(analysisSnapshots)
      .orderBy(desc(analysisSnapshots.createdAt))
      .limit(20)

    const mapped: Anomaly[] = rows.map((r, index) => {
      const snap = r.payload as AnalysisSnapshot
      return {
        id: index + 1,
        umaId: `SNAP-${r.id}`,
        ticker: r.ticker,
        name: r.companyName,
        risk: snap.composite?.score ?? 50,
        price: snap.price ? `Rp ${snap.price.toLocaleString('id-ID')}` : '—',
        change: snap.priceChangeFraction
          ? `${(snap.priceChangeFraction * 100).toFixed(2)}%`
          : '0.00%',
        priceDate: snap.priceDate,
        rawPrice: snap.price,
        rawChange: snap.priceChangeFraction,
        volumeSpike: snap.indicators?.volume?.formattedRatio ?? 'NORMAL 1.0x',
        volumeSpikeRatio: snap.indicators?.volume?.spikeRatio
          ? String(snap.indicators.volume.spikeRatio)
          : null,
        status: snap.composite?.status ?? 'NORMAL',
        compositeScore: snap.composite?.score ?? null,
        reason: snap.composite?.reason ?? '',
        bandarmology: snap.indicators?.bandarmology as unknown as BandarmologyAnalysis,
        catalystDivergence: snap.indicators?.divergence as unknown as CatalystDivergence,
        insiderMovement: snap.indicators?.insider as unknown as InsiderMovementAnalysis,
        newsImpact: null,
        createdAt: r.createdAt,
      }
    })
    return { success: true, data: mapped }
  } catch {
    return { error: 'Riwayat belum dapat dimuat. Pastikan database aktif, lalu klik Refresh.' }
  }
}

export interface ScreenerResult {
  symbol: string
  company_name: string
  sector?: string
  sub_sector?: string
  market_cap?: number | null
  last_close_price?: number | null
  daily_close_change?: number | null
  pe_ttm?: number | null
  pb_mrq?: number | null
  roe_ttm?: number | null
  dividend_yield?: number | null
  yield_ttm?: number | null
  yoy_quarter_earnings_growth?: number | null
}

export async function runScreener(filters: {
  query?: string
  sector?: string
  maxPe?: string
  maxPb?: string
  minMarketCap?: string
  minYield?: string
  minEarningsGrowth?: string
  offset?: number
}): Promise<{ success: boolean; data?: ScreenerResult[]; total?: number; error?: string }> {
  try {
    const key = process.env.SECTORS_API_KEY?.trim()
    if (!key || key === 'your_sectors_api_key_here') {
      return { success: false, error: 'SECTORS_API_KEY belum diisi pada konfigurasi server.' }
    }
    const clauses: string[] = []
    if (filters.sector?.trim())
      clauses.push("sector = '" + filters.sector.trim().replaceAll("'", "''") + "'")
    if (filters.maxPe && Number.isFinite(Number(filters.maxPe)))
      clauses.push('pe_ttm > 0 and pe_ttm <= ' + Number(filters.maxPe))
    if (filters.maxPb && Number.isFinite(Number(filters.maxPb)))
      clauses.push('pb_mrq > 0 and pb_mrq <= ' + Number(filters.maxPb))
    if (filters.minMarketCap && Number.isFinite(Number(filters.minMarketCap)))
      clauses.push('market_cap >= ' + Number(filters.minMarketCap))
    if (filters.minYield && Number.isFinite(Number(filters.minYield)))
      clauses.push('dividend_yield >= ' + Number(filters.minYield))
    if (filters.minEarningsGrowth && Number.isFinite(Number(filters.minEarningsGrowth)))
      clauses.push('yoy_quarter_earnings_growth >= ' + Number(filters.minEarningsGrowth))

    let constructed = clauses.join(' and ')
    if (filters.query?.trim()) {
      constructed = constructed
        ? '(' + constructed + ') and ' + filters.query.trim()
        : filters.query.trim()
    }
    if (!constructed) {
      constructed = 'market_cap > 0'
    }

    const offsetVal = filters.offset ?? 0
    const url =
      'https://api.sectors.app/v1/companies/?query=' +
      encodeURIComponent(constructed) +
      '&offset=' +
      offsetVal +
      '&limit=50'

    const cacheKey = 'screener:' + constructed + ':' + offsetVal
    const result = await getOrSetCache(cacheKey, 300_000, async () => {
      const res = await fetch(url, {
        headers: { Authorization: key },
        next: { revalidate: 300 },
      })
      if (!res.ok) {
        throw new Error('Gagal menjalankan filter saham (status ' + res.status + ')')
      }
      return res.json()
    })

    return {
      success: true,
      data: Array.isArray(result) ? result : (result.data ?? []),
      total: Array.isArray(result) ? result.length : (result.total ?? 0),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menjalankan filter.',
    }
  }
}

export async function getMarketOverviewAction(options?: {
  cutoffDate?: string
  forceRefresh?: boolean
}) {
  const { getMarketOverviewService } = await import('@/lib/server/services/market-overview')
  const result = await getMarketOverviewService(options)
  if (!result.ok) {
    return { success: false, error: result.error.message }
  }
  return { success: true, data: result.data }
}

export async function runMarketScanAction(options?: {
  cutoffDate?: string
  forceRefresh?: boolean
}) {
  const { runMarketScanService } = await import('@/lib/server/services/market-scan')
  const result = await runMarketScanService(options)
  if (!result.ok) {
    return { success: false, error: result.error.message }
  }
  return { success: true, data: result.data }
}

export async function getResearchSnapshotAction(options: { ticker?: string; snapshotId?: string }) {
  const { getResearchSnapshotById, getLatestResearchSnapshotForTicker } =
    await import('@/lib/server/repositories/research-snapshots')

  if (options.snapshotId) {
    const row = await getResearchSnapshotById(options.snapshotId)
    return { success: true, data: row }
  }

  if (options.ticker) {
    const row = await getLatestResearchSnapshotForTicker(options.ticker.toUpperCase())
    return { success: true, data: row }
  }

  return { success: false, error: 'Ticker atau snapshotId harus disediakan.' }
}

export async function getBrokerListAction() {
  try {
    const { getBrokersRegistryList } = await import('@/lib/server/services/broker-activity')
    const list = await getBrokersRegistryList()
    return { success: true, data: list }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat daftar broker.',
    }
  }
}

export async function getBrokerActivityAction(
  brokerCode: string,
  startDate?: string,
  endDate?: string,
  options?: { forceRefresh?: boolean },
) {
  try {
    const { getBrokerActivityService } = await import('@/lib/server/services/broker-activity')
    const data = await getBrokerActivityService(brokerCode, startDate, endDate, options)
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat aktivitas broker.',
    }
  }
}

export async function compareBrokersAction(
  codeA: string,
  codeB: string,
  startDate?: string,
  endDate?: string,
  options?: { forceRefresh?: boolean },
) {
  try {
    const { compareTwoBrokersService } = await import('@/lib/server/services/broker-activity')
    const data = await compareTwoBrokersService(codeA, codeB, startDate, endDate, options)
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal membandingkan aktivitas broker.',
    }
  }
}

export async function saveScreenAction(
  title: string,
  filters: Record<string, unknown>,
  presetId?: string,
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, error: 'AUTH_REQUIRED: Masuk dengan Google untuk menyimpan preset.' }
  }

  try {
    const { createSavedScreen } = await import('@/lib/server/repositories/saved-screens')
    const row = await createSavedScreen(userId, title, filters, presetId)
    return { success: true, data: row }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menyimpan preset filter.',
    }
  }
}

export async function getSavedScreensAction() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk melihat preset tersimpan.',
    }
  }

  try {
    const { getSavedScreensByUserId } = await import('@/lib/server/repositories/saved-screens')
    const list = await getSavedScreensByUserId(userId)
    return { success: true, data: list }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat preset tersimpan.',
    }
  }
}

export async function deleteSavedScreenAction(id: number) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, error: 'AUTH_REQUIRED: Masuk dengan Google untuk menghapus preset.' }
  }

  try {
    const { deleteSavedScreen } = await import('@/lib/server/repositories/saved-screens')
    const ok = await deleteSavedScreen(id, userId)
    return { success: ok }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menghapus preset.',
    }
  }
}

export async function saveResearchNoteAction(
  ticker: string,
  snapshotId: string,
  thesis: string,
  invalidationTriggers?: string,
  watchMetrics?: Record<string, unknown>,
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk menyimpan tesis riset.',
    }
  }

  try {
    const { createOrUpdateResearchNote } = await import('@/lib/server/repositories/research-notes')
    const row = await createOrUpdateResearchNote(
      userId,
      ticker,
      snapshotId,
      thesis,
      invalidationTriggers,
      watchMetrics,
    )
    return { success: true, data: row }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menyimpan tesis riset.',
    }
  }
}

export async function getResearchNotesForTickerAction(ticker: string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk melihat catatan riset.',
    }
  }

  try {
    const { getResearchNotesByTicker } = await import('@/lib/server/repositories/research-notes')
    const list = await getResearchNotesByTicker(userId, ticker)
    return { success: true, data: list }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat catatan riset.',
    }
  }
}

export async function getUserResearchNotesAction() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk melihat catatan riset.',
    }
  }

  try {
    const { getUserResearchNotes } = await import('@/lib/server/repositories/research-notes')
    const list = await getUserResearchNotes(userId)
    return { success: true, data: list }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat catatan riset.',
    }
  }
}

export async function diffSnapshotsAction(snapshotIdA: string, snapshotIdB: string) {
  try {
    const { getResearchSnapshotById } = await import('@/lib/server/repositories/research-snapshots')
    const { diffSnapshots } = await import('@/domain/snapshot-diff')

    const [snapA, snapB] = await Promise.all([
      getResearchSnapshotById(snapshotIdA),
      getResearchSnapshotById(snapshotIdB),
    ])

    if (!snapA || !snapB) {
      return { success: false, error: 'Salah satu atau kedua snapshot tidak ditemukan.' }
    }

    const diff = diffSnapshots(
      snapA.payload as Parameters<typeof diffSnapshots>[0],
      snapB.payload as Parameters<typeof diffSnapshots>[1],
    )
    return { success: true, data: diff }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal membandingkan snapshot.',
    }
  }
}

export async function getSnapshotsForTickerAction(ticker: string) {
  try {
    const { getResearchSnapshotsForTicker } =
      await import('@/lib/server/repositories/research-snapshots')
    const list = await getResearchSnapshotsForTicker(ticker)
    return { success: true, data: list }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat daftar snapshot.',
    }
  }
}
