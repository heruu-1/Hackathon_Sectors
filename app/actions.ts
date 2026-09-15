'use server'

import { desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { type WatchlistItem, anomalies, watchlist } from '@/db/schema'
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
        volumeSpike: intelligence.volumeSpike,
        volumeSpikeRatio: intelligence.volumeSpikeRatio,
        status: intelligence.status,
        compositeScore: intelligence.compositeScore,
        reason: intelligence.reason,
        bandarmology: intelligence.bandarmology,
        catalystDivergence: intelligence.catalystDivergence,
        insiderMovement: intelligence.insiderMovement,
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
      const divergence = detectCatalystDivergence(impact, 0.0, news.timestamp)
      if (divergence.status === 'SLEEPING_GIANT' || impact.impactScore >= 50) {
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
      const analysis = analyzeInsiderMovement([filing], filing.price ? filing.price * 1.1 : 1000)
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
    const items = await db.select().from(watchlist).orderBy(desc(watchlist.updatedAt))
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
    const cleanTicker = normalizeTicker(item.ticker)
    const existing = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.ticker, cleanTicker))
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
    targetPrice?: string
    notes?: string
    priority?: string
    status?: string
  },
): Promise<{
  success: boolean
  data?: WatchlistItem
  error?: string
}> {
  try {
    const [updated] = await db
      .update(watchlist)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(watchlist.id, id))
      .returning()
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
    await db.delete(watchlist).where(eq(watchlist.id, id))
    return { success: true, id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menghapus item dari watchlist.',
    }
  }
}
