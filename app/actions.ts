'use server'

import { headers } from 'next/headers'

import type { Anomaly } from '@/db/schema'
import { detectCatalystDivergence } from '@/domain/divergence'
import { getNewsPriceResponse, isRadarFresh } from '@/domain/radar'
import { isValidTicker } from '@/domain/ticker'
import { auth } from '@/lib/auth'
import type { BandarmologyAnalysis } from '@/lib/bandarmology'
import type { AnalysisSnapshot } from '@/lib/contracts/analysis'
import type { Result } from '@/lib/contracts/result'
import { errorResult, successResult } from '@/lib/contracts/result'
// ---------------------------------------------------------------------------
// Dynamic Signal Analysis Actions (E01 Intraday & Stochastic Projections)
// ---------------------------------------------------------------------------

import type { SignalAnalysisReport } from '@/lib/contracts/signal-analysis'
import { EvaluateSignalAnalysisInputSchema } from '@/lib/contracts/signal-analysis'
import type { WatchlistItemDTO } from '@/lib/contracts/watchlist'
import type { CatalystDivergence } from '@/lib/divergence'
import type { GeminiNewsImpact } from '@/lib/gemini'
import { type InsiderMovementAnalysis, analyzeInsiderMovement } from '@/lib/insider'
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
import { analyzeNewsImpact, fallbackAnalyzeNews } from '@/lib/server/providers/gemini'
import { getRecentPublicSnapshots } from '@/lib/server/repositories/snapshots'
import { deleteWatchlistItem as deleteWatchlistRepoItem } from '@/lib/server/repositories/watchlist'
import {
  type StockDataResult,
  createAnalysis,
  readLatestAnalysis,
  readStockData,
} from '@/lib/server/services/analysis'
import {
  deleteConversationById,
  getConversationDetail,
  listConversations,
} from '@/lib/server/services/assistant'
import { type HistoryListResult, deleteHistory, getHistory } from '@/lib/server/services/history'
import {
  addToWatchlist as addToWatchlistService,
  getWatchlist as getWatchlistService,
  removeFromWatchlist as removeFromWatchlistService,
} from '@/lib/server/services/watchlist'

function parsePriority(val?: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (val === 'HIGH' || val === 'LOW') return val
  return 'MEDIUM'
}

function parseStatus(val?: string): 'WATCHING' | 'ACCUMULATING' | 'SLEEPING_GIANT' | 'BOUGHT' {
  if (val === 'ACCUMULATING' || val === 'SLEEPING_GIANT' || val === 'BOUGHT') return val
  return 'WATCHING'
}

function parseOptionalPriority(val?: string): 'LOW' | 'MEDIUM' | 'HIGH' | undefined {
  if (val === 'HIGH' || val === 'LOW' || val === 'MEDIUM') return val
  return undefined
}

function parseOptionalStatus(
  val?: string,
): 'WATCHING' | 'ACCUMULATING' | 'SLEEPING_GIANT' | 'BOUGHT' | undefined {
  if (
    val === 'ACCUMULATING' ||
    val === 'SLEEPING_GIANT' ||
    val === 'BOUGHT' ||
    val === 'WATCHING'
  ) {
    return val
  }
  return undefined
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user.id ?? null
  } catch {
    return null
  }
}

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

export interface MarketRadarData {
  pendingCatalysts?: MarketRadarData['sleepingGiants']
  sleepingGiants: Array<{
    ticker: string
    headline: string
    impactScore: number
    sentiment: string
    priceChangePct: number | null
    verdict: string
    timestamp?: string
    url?: string | null
  }>
  insiderAlerts: Array<{
    ticker: string
    holderName: string
    action: string
    status: string
    valueIdr: number
    summary: string
    timestamp?: string
  }>
  recentNewsCount: number
  recentFilingsCount: number
  scannedAt?: string
  isCached?: boolean
  warning?: string
}

export interface RadarHistorySnapshot {
  pendingCatalysts?: MarketRadarData['sleepingGiants']
  id: string
  scannedAt: string
  sleepingGiantsCount: number
  insiderAlertsCount: number
  sleepingGiants: MarketRadarData['sleepingGiants']
  insiderAlerts: MarketRadarData['insiderAlerts']
  recentNewsCount: number
  recentFilingsCount: number
}

let memoryRadarCache: MarketRadarData | null = null
let memoryRadarHistory: RadarHistorySnapshot[] = []

async function getRadarCacheFromDb(): Promise<MarketRadarData | null> {
  const { isDbConnectionError, isDbTemporarilyUnavailable, markDbUnavailable } =
    await import('@/lib/server/cache')
  if (!process.env.DATABASE_URL || isDbTemporarilyUnavailable()) return null
  try {
    const { db } = await import('@/db')
    const { apiCache } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const rows = await db
      .select()
      .from(apiCache)
      .where(eq(apiCache.cacheKey, 'market:radar:latest:v2'))
      .limit(1)
    if (rows.length > 0 && rows[0]?.data) {
      return rows[0].data as MarketRadarData
    }
  } catch (err) {
    if (isDbConnectionError(err)) {
      markDbUnavailable()
    }
  }
  return null
}

async function setRadarCacheInDb(data: MarketRadarData): Promise<void> {
  const { isDbConnectionError, isDbTemporarilyUnavailable, markDbUnavailable } =
    await import('@/lib/server/cache')
  if (!process.env.DATABASE_URL || isDbTemporarilyUnavailable()) return
  try {
    const { db } = await import('@/db')
    const { apiCache } = await import('@/db/schema')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await db
      .insert(apiCache)
      .values({
        cacheKey: 'market:radar:latest:v2',
        data: data as unknown as Record<string, unknown>,
        expiresAt,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: apiCache.cacheKey,
        set: {
          data: data as unknown as Record<string, unknown>,
          expiresAt,
          createdAt: new Date(),
        },
      })
  } catch (err) {
    if (isDbConnectionError(err)) {
      markDbUnavailable()
    }
  }
}

async function getRadarHistoryFromDb(): Promise<RadarHistorySnapshot[]> {
  const { isDbConnectionError, isDbTemporarilyUnavailable, markDbUnavailable } =
    await import('@/lib/server/cache')
  if (!process.env.DATABASE_URL || isDbTemporarilyUnavailable()) return []
  try {
    const { db } = await import('@/db')
    const { apiCache } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const rows = await db
      .select()
      .from(apiCache)
      .where(eq(apiCache.cacheKey, 'market:radar:history:v2'))
      .limit(1)
    if (rows.length > 0 && Array.isArray(rows[0]?.data)) {
      return rows[0].data as RadarHistorySnapshot[]
    }
  } catch (err) {
    if (isDbConnectionError(err)) {
      markDbUnavailable()
    }
  }
  return []
}

async function appendRadarHistoryInDb(snapshot: RadarHistorySnapshot): Promise<void> {
  const { isDbConnectionError, isDbTemporarilyUnavailable, markDbUnavailable } =
    await import('@/lib/server/cache')
  if (!process.env.DATABASE_URL || isDbTemporarilyUnavailable()) return
  try {
    const { db } = await import('@/db')
    const { apiCache } = await import('@/db/schema')
    const existing = await getRadarHistoryFromDb()
    const updated = [snapshot, ...existing.filter((s) => s.id !== snapshot.id)].slice(0, 30)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await db
      .insert(apiCache)
      .values({
        cacheKey: 'market:radar:history:v2',
        data: updated as unknown as Record<string, unknown>,
        expiresAt,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: apiCache.cacheKey,
        set: {
          data: updated as unknown as Record<string, unknown>,
          expiresAt,
          createdAt: new Date(),
        },
      })
  } catch (err) {
    if (isDbConnectionError(err)) {
      markDbUnavailable()
    }
  }
}

function extractTickerFromNews(news: { symbols?: string[] }): string | null {
  // Only provider-linked symbols are evidence; free text can contain ordinary words.
  for (const symbol of news.symbols ?? []) {
    const clean = symbol.replace(/\.JK$/i, '').trim().toUpperCase()
    if (isValidTicker(clean)) return clean
  }
  return null
}

let pendingRadarScan: Promise<{ success: boolean; data?: MarketRadarData; error?: string }> | null =
  null

export async function getMarketRadarFeed(options?: { forceRefresh?: boolean }) {
  if (pendingRadarScan) return pendingRadarScan
  pendingRadarScan = readMarketRadarFeed(options)
  try {
    return await pendingRadarScan
  } finally {
    pendingRadarScan = null
  }
}

async function readMarketRadarFeed(options?: { forceRefresh?: boolean }): Promise<{
  success: boolean
  data?: MarketRadarData
  error?: string
}> {
  const forceRefresh = options?.forceRefresh ?? false

  // Shared cache expires; rapid manual refreshes reuse the last scan for one minute.
  const cached = memoryRadarCache ?? (await getRadarCacheFromDb())
  if (
    cached &&
    Array.isArray(cached.pendingCatalysts) &&
    isRadarFresh(cached.scannedAt) &&
    (!forceRefresh || Date.now() - Date.parse(cached.scannedAt!) < 60_000)
  ) {
    memoryRadarCache = cached
    return { success: true, data: { ...cached, isCached: true } }
  }

  try {
    const apiKey = process.env.SECTORS_API_KEY
    const [newsItems, filings] = await Promise.all([
      fetchMarketNews(undefined, apiKey, 30),
      fetchInsiderFilings(undefined, apiKey, 30),
    ])

    const sleepingGiants: MarketRadarData['sleepingGiants'] = []
    const pendingCatalysts: MarketRadarData['sleepingGiants'] = []
    const seenTickers = new Set<string>()

    interface CandidateNewsItem {
      detectedTicker: string
      news: (typeof newsItems)[0]
      impact: ReturnType<typeof fallbackAnalyzeNews>
    }
    const candidateNews: CandidateNewsItem[] = []

    for (const news of newsItems.slice(0, 30)) {
      const detectedTicker = extractTickerFromNews(news)
      if (!detectedTicker || seenTickers.has(detectedTicker)) continue
      const impact = fallbackAnalyzeNews(news.title, news.body ?? '')
      if (impact.sentiment !== 'BULLISH' || impact.impactScore < 40) continue
      seenTickers.add(detectedTicker)
      candidateNews.push({ detectedTicker, news, impact })
      if (candidateNews.length >= 8) break
    }

    // Fetch observed price responses concurrently
    await Promise.all(
      candidateNews.map(async ({ detectedTicker, news, impact }) => {
        const cleanSymbol = detectedTicker
        const daily = await getOrSetCache(`radar:daily:90:${detectedTicker}`, 900_000, () =>
          fetchDailyTransactions(detectedTicker, apiKey),
        ).catch(() => [])
        const priceChangeFraction = getNewsPriceResponse(daily, news.timestamp)

        const newsUrl = news.source?.startsWith('http')
          ? news.source
          : (((news as Record<string, unknown>).url as string | null) ?? null)
        const divergence = detectCatalystDivergence(
          impact,
          priceChangeFraction,
          news.timestamp,
          newsUrl,
        )

        // A candidate without a measured response must not be called a sleeping giant.
        if (divergence.status === 'SLEEPING_GIANT' || divergence.status === 'NO_PRICE_RESPONSE') {
          const target = divergence.status === 'SLEEPING_GIANT' ? sleepingGiants : pendingCatalysts
          target.push({
            ticker: cleanSymbol,
            headline: news.title,
            impactScore: impact.impactScore,
            sentiment: impact.sentiment,
            priceChangePct: divergence.priceChangePct,
            verdict: divergence.verdict,
            timestamp: news.timestamp,
            url: newsUrl,
          })
        }
      }),
    )

    const insiderAlerts: MarketRadarData['insiderAlerts'] = []
    for (const filing of filings) {
      const ticker = (filing.symbol ?? '').replace(/\.JK$/i, '').toUpperCase()
      if (!isValidTicker(ticker)) continue
      const analysis = analyzeInsiderMovement([filing], null)
      if (analysis.status !== 'NO_RECENT_FILINGS') {
        insiderAlerts.push({
          ticker,
          holderName: analysis.latestFiling?.holderName ?? 'Insider',
          action: analysis.latestFiling?.action ?? 'TRANSACTION',
          status: analysis.status,
          valueIdr: analysis.latestFiling?.totalValueIdr ?? 0,
          summary: analysis.summary,
          timestamp: filing.timestamp,
        })
      }
    }

    const nowIso = new Date().toISOString()
    const radarData: MarketRadarData = {
      sleepingGiants,
      pendingCatalysts,
      insiderAlerts,
      recentNewsCount: newsItems.length,
      recentFilingsCount: filings.length,
      scannedAt: nowIso,
      isCached: false,
    }

    // Update caches
    memoryRadarCache = radarData
    await setRadarCacheInDb(radarData)

    // Append to history
    const historySnapshot: RadarHistorySnapshot = {
      pendingCatalysts,
      id: `RADAR-${Date.now()}`,
      scannedAt: nowIso,
      sleepingGiantsCount: sleepingGiants.length,
      insiderAlertsCount: insiderAlerts.length,
      sleepingGiants,
      insiderAlerts,
      recentNewsCount: newsItems.length,
      recentFilingsCount: filings.length,
    }
    memoryRadarHistory = [historySnapshot, ...memoryRadarHistory].slice(0, 30)
    await appendRadarHistoryInDb(historySnapshot)

    return {
      success: true,
      data: radarData,
    }
  } catch (error) {
    if (memoryRadarCache) {
      return {
        success: true,
        data: {
          ...memoryRadarCache,
          isCached: true,
          warning: 'Pemindaian baru gagal. Menampilkan hasil terakhir yang tersimpan.',
        },
      }
    }
    const dbCache = await getRadarCacheFromDb()
    if (dbCache) {
      return {
        success: true,
        data: {
          ...dbCache,
          isCached: true,
          warning: 'Pemindaian baru gagal. Menampilkan hasil terakhir yang tersimpan.',
        },
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat feed radar pasar.',
    }
  }
}

export async function getRadarHistory(): Promise<{
  success: boolean
  data?: RadarHistorySnapshot[]
  error?: string
}> {
  try {
    const dbHistory = await getRadarHistoryFromDb()
    if (dbHistory.length > 0) {
      return { success: true, data: dbHistory }
    }
    return { success: true, data: memoryRadarHistory }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal memuat riwayat radar.',
    }
  }
}

export async function clearRadarHistory(): Promise<{
  success: boolean
  error?: string
}> {
  // Shared public snapshots must never be deleted by an anonymous server action.
  return {
    success: false,
    error:
      'Riwayat pasar bersifat bersama. Sembunyikan riwayat di browser ini melalui halaman radar.',
  }
}

export async function getWatchlist(): Promise<{
  success: boolean
  data?: WatchlistItemDTO[]
  error?: string
}> {
  const userId = await getCurrentUserId()
  if (!userId) return { success: true, data: [] }
  const result = await getWatchlistService(userId)
  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true, data: result.data }
}

export async function addToWatchlist(item: {
  ticker: string
  name?: string
  targetPrice?: number | string
  notes?: string
  priority?: string
  status?: string
  lastPrice?: number | string
  lastChange?: number | string
}) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk menyimpan pantauan.',
    }
  }

  const numTargetPrice =
    typeof item.targetPrice === 'string' ? parseFloat(item.targetPrice) : item.targetPrice
  const numLastPrice =
    typeof item.lastPrice === 'string' ? parseFloat(item.lastPrice) : item.lastPrice
  const numLastChange =
    typeof item.lastChange === 'string'
      ? parseFloat(item.lastChange.replace('%', '')) / 100
      : item.lastChange

  const priority = parsePriority(item.priority)
  const status = parseStatus(item.status)

  const result = await addToWatchlistService(userId, {
    ticker: item.ticker,
    name: item.name,
    targetPrice: Number.isFinite(numTargetPrice) ? numTargetPrice : null,
    notes: item.notes ?? null,
    priority,
    status,
    lastPrice: Number.isFinite(numLastPrice) ? numLastPrice : null,
    lastChange: Number.isFinite(numLastChange) ? numLastChange : null,
  })

  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true, data: result.data, isNew: true }
}

export async function updateWatchlistItem(
  id: number,
  updates: {
    targetPrice?: number | string | null
    notes?: string | null
    priority?: string
    status?: string
  },
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk mengubah pantauan.',
    }
  }

  const numTargetPrice =
    typeof updates.targetPrice === 'string' ? parseFloat(updates.targetPrice) : updates.targetPrice

  const priority = parseOptionalPriority(updates.priority)
  const status = parseOptionalStatus(updates.status)

  // Import directly from repository for id-based update
  const { updateWatchlistItem: updateRepoItem } =
    await import('@/lib/server/repositories/watchlist')
  const updated = await updateRepoItem(userId, id, {
    targetPrice: Number.isFinite(numTargetPrice) ? numTargetPrice : null,
    notes: updates.notes ?? null,
    priority,
    status,
  })

  if (!updated) return { success: false, error: 'Pantauan tidak ditemukan.' }
  return { success: true, data: updated }
}

export async function deleteWatchlistItem(idOrTicker: number | string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk menghapus pantauan.',
    }
  }

  if (typeof idOrTicker === 'string') {
    const result = await removeFromWatchlistService(userId, idOrTicker)
    if (!result.ok) return { success: false, error: result.error.message }
    return { success: true, id: idOrTicker }
  }

  const deleted = await deleteWatchlistRepoItem(userId, idOrTicker)
  if (!deleted) return { success: false, error: 'Pantauan tidak ditemukan.' }
  return { success: true, id: idOrTicker }
}

export async function getUserHistoryAction(options?: {
  ticker?: string
  limit?: number
  offset?: number
}): Promise<{ success: boolean; data?: HistoryListResult; error?: string }> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk melihat riwayat analisis.',
    }
  }
  const result = await getHistory(userId, options)
  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true, data: result.data }
}

export async function deleteHistoryAction(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk menghapus riwayat.',
    }
  }
  const result = await deleteHistory(userId, id)
  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true }
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
      clauses.push('market_cap >= ' + Number(filters.minMarketCap) * 1_000_000_000_000)
    if (filters.minYield && Number.isFinite(Number(filters.minYield)))
      clauses.push('yield_ttm > ' + Number(filters.minYield))
    if (filters.minEarningsGrowth && Number.isFinite(Number(filters.minEarningsGrowth)))
      clauses.push('yoy_quarter_earnings_growth > ' + Number(filters.minEarningsGrowth))
    const BASE_COLUMNS_WHERE = [
      '(sector is not null or sector is null)',
      '(sub_sector is not null or sub_sector is null)',
      '(last_close_price is not null or last_close_price is null)',
      '(pe_ttm is not null or pe_ttm is null)',
      '(pb_mrq is not null or pb_mrq is null)',
      '(yield_ttm is not null or yield_ttm is null)',
      '(roe_ttm is not null or roe_ttm is null)',
      '(daily_close_change is not null or daily_close_change is null)',
      '(yoy_quarter_earnings_growth is not null or yoy_quarter_earnings_growth is null)',
    ].join(' and ')

    const params = new URLSearchParams({
      limit: '25',
      offset: String(Math.max(0, filters.offset ?? 0)),
      order_by: '-market_cap',
      include_query_values: 'true',
    })
    if (filters.query?.trim()) {
      params.set('q', filters.query.trim().slice(0, 120))
    } else {
      const whereClause = clauses.length
        ? `${clauses.join(' and ')} and ${BASE_COLUMNS_WHERE}`
        : BASE_COLUMNS_WHERE
      params.set('where', whereClause)
    }

    const { requestSectorsShared } = await import('@/lib/server/providers/transport')
    const payload = await requestSectorsShared<{
      results?: ScreenerResult[]
      pagination?: { total_count?: number }
    }>('https://api.sectors.app/v2/companies/?' + params.toString(), {
      capabilityId: 'companies_screener',
      apiKey: key,
      timeoutMs: 10_000,
    })

    if (filters.query?.trim() && payload.results && payload.results.length > 0) {
      const symbols = payload.results.map((r) => r.symbol).filter(Boolean)
      if (symbols.length > 0) {
        try {
          const enrichWhere =
            symbols.map((s) => `symbol = '${s.replaceAll("'", "''")}'`).join(' or ') +
            ' and ' +
            BASE_COLUMNS_WHERE
          const enrichParams = new URLSearchParams({
            limit: String(symbols.length),
            include_query_values: 'true',
            where: enrichWhere,
          })
          const enrichPayload = await requestSectorsShared<{
            results?: Array<{ symbol?: string; query_values?: Record<string, unknown> }>
          }>('https://api.sectors.app/v2/companies/?' + enrichParams.toString(), {
            capabilityId: 'companies_screener',
            apiKey: key,
            timeoutMs: 10_000,
          })
          const map = new Map<string, Record<string, unknown>>()
          for (const item of enrichPayload.results ?? []) {
            if (item.symbol && item.query_values) {
              map.set(item.symbol, item.query_values)
            }
          }
          for (const r of payload.results) {
            const qv = map.get(r.symbol)
            if (qv) {
              const rawItem = r as ScreenerResult & { query_values?: Record<string, unknown> }
              rawItem.query_values = { ...qv, ...rawItem.query_values }
            }
          }
        } catch {
          // If enrichment fails, continue with original results
        }
      }
    }

    const rows = (payload.results ?? []).map((row) => {
      const raw = row as ScreenerResult & { query_values?: Record<string, unknown> }
      const qv = raw.query_values ?? {}
      return {
        symbol: row.symbol,
        company_name: row.company_name,
        sector: (qv.sector as string) ?? (qv.sub_sector as string) ?? undefined,
        sub_sector: (qv.sub_sector as string) ?? undefined,
        market_cap: typeof qv.market_cap === 'number' ? qv.market_cap : null,
        last_close_price: typeof qv.last_close_price === 'number' ? qv.last_close_price : null,
        daily_close_change:
          typeof qv.daily_close_change === 'number' ? qv.daily_close_change : null,
        pe_ttm: typeof qv.pe_ttm === 'number' ? qv.pe_ttm : null,
        pb_mrq: typeof qv.pb_mrq === 'number' ? qv.pb_mrq : null,
        roe_ttm: typeof qv.roe_ttm === 'number' ? qv.roe_ttm : null,
        dividend_yield:
          typeof qv.yield_ttm === 'number'
            ? qv.yield_ttm
            : typeof qv.dividend_yield === 'number'
              ? qv.dividend_yield
              : null,
        yield_ttm: typeof qv.yield_ttm === 'number' ? qv.yield_ttm : null,
        yoy_quarter_earnings_growth:
          typeof qv.yoy_quarter_earnings_growth === 'number'
            ? qv.yoy_quarter_earnings_growth
            : null,
      } as ScreenerResult
    })
    return {
      success: true,
      data: rows,
      total: payload.pagination?.total_count ?? rows.length,
    }
  } catch {
    return {
      success: false,
      error: 'Screener tidak dapat dihubungkan sekarang. Coba lagi setelah beberapa saat.',
    }
  }
}

export async function listConversationsAction() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk melihat percakapan.',
    }
  }
  const result = await listConversations(userId)
  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true, data: result.data }
}

export async function getConversationAction(conversationId: string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk melihat percakapan.',
    }
  }
  const result = await getConversationDetail(userId, conversationId)
  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true, data: result.data }
}

export async function deleteConversationAction(conversationId: string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk menghapus percakapan.',
    }
  }
  const result = await deleteConversationById(userId, conversationId)
  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true }
}

/**
 * Market Intelligence Actions (Category 3)
 */
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

// ---------------------------------------------------------------------------
// Saved Screens Actions (F10)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Research Notes Actions (F12)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Snapshot Diff Action (F12)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Signal Outcomes Actions (E01, E02)
// ---------------------------------------------------------------------------

export async function getSignalOutcomesAction(ticker: string) {
  try {
    const { getSignalOutcomesForTicker } = await import('@/lib/server/repositories/signal-outcomes')
    const list = await getSignalOutcomesForTicker(ticker)
    return { success: true, data: list }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat evaluasi sinyal.',
    }
  }
}

export async function evaluateSignalOutcomesAction(
  ticker: string,
  snapshotId: string,
  ruleId: string,
  signalDate: string,
  initialPrice: number | null,
) {
  try {
    const { fetchDailyPrices } = await import('@/lib/server/providers/sectors')
    const { evaluateSignalOutcomes } = await import('@/domain/signal-outcomes')
    const { upsertSignalOutcome, getSignalOutcomesForTicker } =
      await import('@/lib/server/repositories/signal-outcomes')

    const dailyEnvelope = await fetchDailyPrices(ticker, undefined, 30)
    const dailyRows = dailyEnvelope.data ?? []
    // Sort chronological: oldest first
    const sortedPrices = [...dailyRows].sort((a, b) => a.date.localeCompare(b.date))

    const evaluations = evaluateSignalOutcomes(
      snapshotId,
      ticker,
      ruleId,
      'rasi-mi-v2',
      signalDate,
      initialPrice,
      sortedPrices,
    )

    for (const ev of evaluations) {
      await upsertSignalOutcome(ev)
    }

    const updated = await getSignalOutcomesForTicker(ticker)
    return { success: true, data: updated }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mengevaluasi outcome sinyal.',
    }
  }
}

export async function getSignalAnalysisAction(
  ticker: string,
): Promise<Result<SignalAnalysisReport | null>> {
  try {
    const cleanTicker = (ticker || '').trim().toUpperCase()
    if (!cleanTicker || cleanTicker.length > 10) {
      return errorResult('VALIDATION_ERROR', 'Ticker saham tidak valid.')
    }

    const { getSignalAnalysisReport } = await import('@/lib/server/services/signal-analysis')
    const report = await getSignalAnalysisReport(cleanTicker)
    return successResult(report)
  } catch (error) {
    return errorResult(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Gagal memuat evaluasi sinyal.',
    )
  }
}

export async function evaluateSignalAnalysisAction(
  input: unknown,
): Promise<Result<SignalAnalysisReport>> {
  try {
    const parsed = EvaluateSignalAnalysisInputSchema.safeParse(input)
    if (!parsed.success) {
      return errorResult('VALIDATION_ERROR', 'Input evaluasi sinyal tidak valid.', {
        fieldErrors: parsed.error.flatten().fieldErrors as unknown as Record<string, string>,
      })
    }

    const { ticker, contextId, requestKey } = parsed.data
    const { getOptionalSession } = await import('@/lib/server/session')
    const session = await getOptionalSession()
    const userId = session?.id ?? 'guest-user'

    // Rate limiting: 2 per minute, 20 per day
    const { consumeQuota } = await import('@/lib/server/quota')
    const quotaRes = await consumeQuota(userId, 'signal_analysis')
    if (!quotaRes.ok) {
      return quotaRes
    }

    // Idempotency deduplication
    const { withIdempotency } = await import('@/lib/server/idempotency')
    return await withIdempotency<Result<SignalAnalysisReport>>(
      userId,
      'signal_analysis',
      requestKey,
      async () => {
        const { evaluateSignalAnalysis } = await import('@/lib/server/services/signal-analysis')
        const report = await evaluateSignalAnalysis({ ticker, contextId })
        return successResult(report)
      },
    )
  } catch (error) {
    return errorResult(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Gagal menjalankan evaluasi sinyal.',
    )
  }
}
