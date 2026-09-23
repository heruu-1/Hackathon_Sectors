'use server'

import { detectCatalystDivergence } from '@/domain/divergence'
import { getNewsPriceResponse, isRadarFresh } from '@/domain/radar'
import { isValidTicker } from '@/domain/ticker'
import { analyzeInsiderMovement } from '@/lib/insider'
import { fetchDailyTransactions, fetchInsiderFilings, fetchMarketNews } from '@/lib/sectors'
import { getOrSetCache } from '@/lib/server/cache'
import { fallbackAnalyzeNews } from '@/lib/server/providers/gemini'

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
            ticker: detectedTicker,
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
