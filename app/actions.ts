'use server'

import { headers } from 'next/headers'

import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { type WatchlistItem, anomalies, watchlist } from '@/db/schema'
import { auth } from '@/lib/auth'
import { detectCatalystDivergence } from '@/lib/divergence'
import { analyzeNewsImpact } from '@/lib/gemini'
import { analyzeInsiderMovement } from '@/lib/insider'
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

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user.id ?? null
}

export async function getRecentAnomalies() {
  try {
    const recentAnomalies = await db
      .select()
      .from(anomalies)
      .orderBy(desc(anomalies.createdAt))
      .limit(20)
    return { success: true, data: recentAnomalies }
  } catch {
    return { error: 'Riwayat belum dapat dimuat. Pastikan database aktif, lalu klik Refresh.' }
  }
}

export async function analyzeTicker(ticker: string) {
  try {
    const cleanTicker = normalizeTicker(ticker)
    const apiKey = process.env.SECTORS_API_KEY

    // 1. Fetch data concurrently (cached by getCached)
    const [reportData, dailyRows, brokerData, brokerRegistry, newsItems, filings] =
      await Promise.all([
        fetchCompanyReport(cleanTicker, apiKey),
        fetchDailyTransactions(cleanTicker, apiKey).catch(() => []),
        fetchBrokerSummary(cleanTicker, apiKey).catch(() => ({ symbol: cleanTicker, data: [] })),
        fetchBrokersRegistry(apiKey).catch(() => ({})),
        fetchMarketNews(cleanTicker, apiKey, 3).catch(() => []),
        fetchInsiderFilings(cleanTicker, apiKey, 3).catch(() => []),
      ])

    // 2. Analyze News with Gemini AI if any news exists
    let newsImpact = null
    if (newsItems.length > 0) {
      const topNews = newsItems[0]
      newsImpact = await analyzeNewsImpact(topNews.title, topNews.body, cleanTicker)
    }

    // 3. Build unified 4-pillar intelligence
    const intelligence = buildFullIntelligence({
      ticker: cleanTicker,
      reportData,
      dailyRows,
      brokerData,
      brokerRegistry,
      newsItems,
      newsImpact,
      filings,
    })

    // 4. Persist to PostgreSQL database
    const [insertedAnomaly] = await db
      .insert(anomalies)
      .values({
        umaId: `UMA-${crypto.randomUUID()}`,
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
      })
      .returning()

    return { success: true, data: insertedAnomaly }
  } catch (error) {
    return {
      error:
        error instanceof SectorsError
          ? error.message
          : 'Analisis belum dapat disimpan. Pastikan database aktif, lalu coba lagi.',
    }
  }
}

export interface MarketRadarData {
  sleepingGiants: Array<{
    ticker: string
    headline: string
    impactScore: number
    sentiment: string
    priceChangePct: number
    verdict: string
    timestamp?: string
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
}

export async function getMarketRadarFeed(): Promise<{
  success: boolean
  data?: MarketRadarData
  error?: string
}> {
  try {
    const apiKey = process.env.SECTORS_API_KEY
    const [newsItems, filings] = await Promise.all([
      fetchMarketNews(undefined, apiKey, 6).catch(() => []),
      fetchInsiderFilings(undefined, apiKey, 6).catch(() => []),
    ])

    const sleepingGiants: MarketRadarData['sleepingGiants'] = []
    for (const news of newsItems.slice(0, 4)) {
      const symbols = (news as { symbols?: string[] }).symbols ?? []
      const rawSymbol = symbols[0]
      const cleanSymbol = rawSymbol ? rawSymbol.replace(/\.JK$/i, '') : 'IDX'
      const impact = await analyzeNewsImpact(news.title, news.body, cleanSymbol)
      // Estimate or fetch quick divergence
      // A radar headline without a matching price series must not be treated
      // as a measured 0% move. The divergence engine will mark this as
      // NO_PRICE_RESPONSE and keep the result explanatory for beginners.
      const divergence = detectCatalystDivergence(impact, null, news.timestamp)
      if (
        divergence.status === 'SLEEPING_GIANT' ||
        (divergence.status !== 'NO_PRICE_RESPONSE' && impact.impactScore >= 50)
      ) {
        sleepingGiants.push({
          ticker: cleanSymbol,
          headline: news.title,
          impactScore: impact.impactScore,
          sentiment: impact.sentiment,
          priceChangePct: divergence.priceChangePct,
          verdict: divergence.verdict,
          timestamp: news.timestamp,
        })
      }
    }

    const insiderAlerts: MarketRadarData['insiderAlerts'] = []
    for (const filing of filings.slice(0, 4)) {
      const ticker = (filing.symbol ?? 'IDX').replace(/\.JK$/i, '')
      // Never manufacture a market price for an insider filing. A filing can
      // still be shown while its discount comparison remains unavailable.
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

    return {
      success: true,
      data: {
        sleepingGiants,
        insiderAlerts,
        recentNewsCount: newsItems.length,
        recentFilingsCount: filings.length,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat feed radar pasar.',
    }
  }
}

export async function getWatchlist(): Promise<{
  success: boolean
  data?: WatchlistItem[]
  error?: string
}> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return { success: true, data: [] }
    const items = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(desc(watchlist.updatedAt))
    return { success: true, data: items }
  } catch {
    return { success: false, error: 'Gagal memuat watchlist. Pastikan database aktif.' }
  }
}

export async function addToWatchlist(item: {
  ticker: string
  name?: string
  targetPrice?: string
  notes?: string
  priority?: string
  status?: string
  lastPrice?: string
  lastChange?: string
}): Promise<{
  success: boolean
  data?: WatchlistItem
  isNew?: boolean
  error?: string
}> {
  try {
    const userId = await getCurrentUserId()
    if (!userId)
      return {
        success: false,
        error: 'AUTH_REQUIRED: Masuk dengan Google untuk menyimpan pantauan.',
      }
    const cleanTicker = normalizeTicker(item.ticker)
    const existing = await db
      .select()
      .from(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.ticker, cleanTicker)))
      .limit(1)

    if (existing.length > 0) {
      const [updated] = await db
        .update(watchlist)
        .set({
          name: item.name || existing[0].name,
          targetPrice: item.targetPrice !== undefined ? item.targetPrice : existing[0].targetPrice,
          notes: item.notes !== undefined ? item.notes : existing[0].notes,
          priority: item.priority || existing[0].priority,
          status: item.status || existing[0].status,
          lastPrice: item.lastPrice || existing[0].lastPrice,
          lastChange: item.lastChange || existing[0].lastChange,
          updatedAt: new Date(),
        })
        .where(eq(watchlist.id, existing[0].id))
        .returning()
      return { success: true, data: updated, isNew: false }
    }

    const [inserted] = await db
      .insert(watchlist)
      .values({
        userId,
        ticker: cleanTicker,
        name: item.name || cleanTicker,
        targetPrice: item.targetPrice || null,
        notes: item.notes || null,
        priority: item.priority || 'MEDIUM',
        status: item.status || 'WATCHING',
        lastPrice: item.lastPrice || null,
        lastChange: item.lastChange || null,
      })
      .returning()
    return { success: true, data: inserted, isNew: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menambahkan ke watchlist.',
    }
  }
}

export async function updateWatchlistItem(
  id: number,
  updates: {
    targetPrice?: string | null
    notes?: string | null
    priority?: string
    status?: string
  },
): Promise<{
  success: boolean
  data?: WatchlistItem
  error?: string
}> {
  try {
    const userId = await getCurrentUserId()
    if (!userId)
      return {
        success: false,
        error: 'AUTH_REQUIRED: Masuk dengan Google untuk mengubah pantauan.',
      }
    const [updated] = await db
      .update(watchlist)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)))
      .returning()
    if (!updated) return { success: false, error: 'Pantauan tidak ditemukan.' }
    return { success: true, data: updated }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memperbarui watchlist.',
    }
  }
}

export async function deleteWatchlistItem(id: number): Promise<{
  success: boolean
  id?: number
  error?: string
}> {
  try {
    const userId = await getCurrentUserId()
    if (!userId)
      return {
        success: false,
        error: 'AUTH_REQUIRED: Masuk dengan Google untuk menghapus pantauan.',
      }
    const deleted = await db
      .delete(watchlist)
      .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)))
      .returning({ id: watchlist.id })
    if (!deleted.length) return { success: false, error: 'Pantauan tidak ditemukan.' }
    return { success: true, id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menghapus item dari watchlist.',
    }
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
      clauses.push('market_cap >= ' + Number(filters.minMarketCap) * 1_000_000_000_000)
    if (filters.minYield && Number.isFinite(Number(filters.minYield)))
      clauses.push('yield_ttm > ' + Number(filters.minYield))
    if (filters.minEarningsGrowth && Number.isFinite(Number(filters.minEarningsGrowth)))
      clauses.push('yoy_quarter_earnings_growth > ' + Number(filters.minEarningsGrowth))
    const params = new URLSearchParams({
      limit: '25',
      offset: String(Math.max(0, filters.offset ?? 0)),
      order_by: '-market_cap',
    })
    if (filters.query?.trim()) params.set('q', filters.query.trim().slice(0, 120))
    else if (clauses.length) params.set('where', clauses.join(' and '))
    const raw = await fetch('https://api.sectors.app/v2/companies/?' + params.toString(), {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    if (!raw.ok)
      return {
        success: false,
        error: 'Screener belum dapat memuat data (HTTP ' + raw.status + ').',
      }
    const payload = (await raw.json()) as {
      results?: ScreenerResult[]
      pagination?: { total_count?: number }
    }
    const rows = (payload.results ?? []).map((row) => {
      const raw = row as ScreenerResult & { query_values?: Partial<ScreenerResult> }
      return { ...raw.query_values, ...raw, query_values: undefined } as ScreenerResult
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
