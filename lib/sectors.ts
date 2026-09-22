import {
  type BandarmologyAnalysis,
  type DailyPriceRow,
  analyzeBandarmology,
  calculateVolumeSpike,
} from './bandarmology.ts'
import { type CatalystDivergence, detectCatalystDivergence } from './divergence.ts'
import type { GeminiNewsImpact } from './gemini.ts'
import {
  type InsiderFilingRow,
  type InsiderMovementAnalysis,
  analyzeInsiderMovement,
} from './insider.ts'

export class SectorsError extends Error {}

export function validateKey(apiKey: string | undefined): string {
  const key = apiKey?.trim()
  if (!key || key === 'your_sectors_api_key_here') {
    throw new SectorsError('SECTORS_API_KEY belum diisi pada konfigurasi server.')
  }
  return key
}

function detectCapabilityId(url: string): {
  capabilityId: string
  params?: Record<string, unknown>
} {
  if (url.includes('/company/report/')) {
    const urlObj = new URL(url)
    const sections = urlObj.searchParams.get('sections')?.split(',').filter(Boolean) || [
      'valuation',
    ]
    return { capabilityId: 'company_report', params: { sections } }
  }
  if (url.includes('/daily/')) return { capabilityId: 'daily_price' }
  if (url.includes('/broker-summary/')) return { capabilityId: 'broker_summary' }
  if (url.includes('/broker-activity/')) return { capabilityId: 'broker_activity' }
  if (url.includes('/brokers/')) return { capabilityId: 'brokers_registry' }
  if (url.includes('/news/')) return { capabilityId: 'market_news' }
  if (url.includes('/filings/')) return { capabilityId: 'filings' }
  if (url.includes('/companies/')) return { capabilityId: 'companies_screener' }
  return { capabilityId: 'daily_price' }
}

async function executeSectorsRequest(
  url: string,
  key: string,
  request: typeof fetch = fetch,
  timeoutMs: number = 10_000,
) {
  try {
    const { requestSectorsShared, SectorsProviderError } =
      await import('./server/providers/transport.ts')
    const { capabilityId, params } = detectCapabilityId(url)
    return await requestSectorsShared(url, {
      capabilityId,
      params,
      apiKey: key,
      fetchFn: request,
      timeoutMs,
    })
  } catch (error) {
    if (error instanceof SectorsError) throw error
    const message = error instanceof Error ? error.message : 'Layanan data pasar bermasalah.'
    throw new SectorsError(message)
  }
}

// In-memory cache to save Sectors API credits across requests
const memoryCache = new Map<string, { expires: number; data: unknown }>()

export async function getCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now()
  const cached = memoryCache.get(key)
  if (cached && cached.expires > now) {
    return cached.data as T
  }

  // The process cache is fast, but it disappears on a serverless restart.
  // When a database is configured, reuse the shared api_cache table as the
  // durable layer. Tests and local setup without DATABASE_URL still work
  // entirely in memory.
  if (process.env.DATABASE_URL) {
    try {
      const [{ db }, { apiCache }, { eq }] = await Promise.all([
        import('../db/index.ts'),
        import('../db/schema.ts'),
        import('drizzle-orm'),
      ])
      const persisted = await db.select().from(apiCache).where(eq(apiCache.cacheKey, key)).limit(1)
      const row = persisted[0]
      if (row && row.expiresAt.getTime() > now) {
        memoryCache.set(key, { expires: row.expiresAt.getTime(), data: row.data })
        return row.data as T
      }
    } catch {
      // A cache outage must never make public market data unavailable.
    }
  }

  const fresh = await fetcher()
  memoryCache.set(key, { expires: now + ttlMs, data: fresh })

  if (process.env.DATABASE_URL) {
    try {
      const [{ db }, { apiCache }] = await Promise.all([
        import('../db/index.ts'),
        import('../db/schema.ts'),
      ])
      await db
        .insert(apiCache)
        .values({ cacheKey: key, data: fresh, expiresAt: new Date(now + ttlMs) })
        .onConflictDoUpdate({
          target: apiCache.cacheKey,
          set: { data: fresh, expiresAt: new Date(now + ttlMs), createdAt: new Date() },
        })
    } catch {
      // Keep the in-memory value when PostgreSQL is unavailable.
    }
  }

  return fresh
}

export function normalizeTicker(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z]{4}(\.JK)?$/i.test(value.trim())) {
    throw new SectorsError('Masukkan kode saham IDX 4 huruf, misalnya BBCA atau BBCA.JK.')
  }
  return value.trim().toUpperCase().replace(/\.JK$/, '')
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function number(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function fetchCompanyReport(
  ticker: string,
  apiKey: string | undefined,
  request: typeof fetch = fetch,
) {
  const key = validateKey(apiKey)
  const symbol = normalizeTicker(ticker)
  return executeSectorsRequest(
    `https://api.sectors.app/v2/company/report/${symbol}/?sections=valuation`,
    key,
    request,
  )
}

export async function fetchDailyTransactions(
  ticker: string,
  apiKey: string | undefined,
  request: typeof fetch = fetch,
  daysBack: number = 90,
): Promise<DailyPriceRow[]> {
  const key = validateKey(apiKey)
  const symbol = normalizeTicker(ticker)

  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - daysBack * 86_400_000).toISOString().split('T')[0]

  const cacheKey = `daily_${symbol}_${startDate}_${endDate}`
  return getCached(cacheKey, 15 * 60 * 1000, async () => {
    const raw = await executeSectorsRequest(
      `https://api.sectors.app/v2/daily/${symbol}/?start=${startDate}&end=${endDate}`,
      key,
      request,
    )
    if (Array.isArray(raw)) {
      return raw as DailyPriceRow[]
    }
    return []
  })
}

export async function fetchBrokersRegistry(
  apiKey: string | undefined,
  request: typeof fetch = fetch,
) {
  const key = validateKey(apiKey)
  // Cache broker registry for 24 hours (88 brokers rarely change)
  return getCached('brokers_registry', 24 * 60 * 60 * 1000, async () => {
    const raw = await executeSectorsRequest('https://api.sectors.app/v2/brokers/', key, request)
    const map: Record<
      string,
      {
        code: string
        name: string
        is_foreign: boolean
        cohort: 'institutional' | 'retail' | 'mixed'
      }
    > = {}
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item && typeof item.code === 'string') {
          map[item.code] = {
            code: item.code,
            name: item.name ?? item.code,
            is_foreign: Boolean(item.is_foreign),
            cohort: item.cohort ?? 'institutional',
          }
        }
      }
    }
    return map
  })
}

export async function fetchBrokerSummary(
  ticker: string,
  apiKey: string | undefined,
  request: typeof fetch = fetch,
  daysBack: number = 10,
) {
  const key = validateKey(apiKey)
  const symbol = normalizeTicker(ticker)

  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - daysBack * 86_400_000).toISOString().split('T')[0]

  const cacheKey = `broker_${symbol}_${startDate}_${endDate}`
  return getCached(cacheKey, 15 * 60 * 1000, async () => {
    return executeSectorsRequest(
      `https://api.sectors.app/v2/broker-summary/${symbol}/?start=${startDate}&end=${endDate}`,
      key,
      request,
    )
  })
}

export async function fetchMarketNews(
  symbols?: string,
  apiKey?: string,
  limit: number = 5,
  request: typeof fetch = fetch,
) {
  const key = validateKey(apiKey)
  const cleanSymbol = symbols ? normalizeTicker(symbols) : undefined
  const param = cleanSymbol
    ? `symbols=${cleanSymbol}&limit=${limit}`
    : `extension=idx&limit=${limit}`
  const cacheKey = `news_${param}`

  return getCached(cacheKey, 10 * 60 * 1000, async () => {
    const raw = (await executeSectorsRequest(
      `https://api.sectors.app/v2/news/?${param}`,
      key,
      request,
    )) as {
      results?: Array<{
        title: string
        body: string
        source: string
        timestamp: string
        symbols?: string[]
      }>
    }
    return raw?.results ?? []
  })
}

export async function fetchInsiderFilings(
  symbol?: string,
  apiKey?: string,
  limit: number = 5,
  request: typeof fetch = fetch,
): Promise<InsiderFilingRow[]> {
  const key = validateKey(apiKey)
  const cleanSymbol = symbol ? normalizeTicker(symbol) : undefined
  const param = cleanSymbol ? `symbol=${cleanSymbol}&limit=${limit}` : `limit=${limit}`
  const cacheKey = `filings_${param}`

  return getCached(cacheKey, 10 * 60 * 1000, async () => {
    const raw = (await executeSectorsRequest(
      `https://api.sectors.app/v2/filings/?${param}`,
      key,
      request,
    )) as { results?: InsiderFilingRow[] }
    return raw?.results ?? []
  })
}

export function buildAnalysis(input: unknown, ticker: string) {
  const data = record(input)
  if (typeof data.symbol !== 'string' || normalizeTicker(data.symbol) !== ticker) {
    throw new SectorsError('Respons Sectors tidak sesuai dengan kode saham yang diminta.')
  }
  const valuation = record(data.valuation)
  const history = Array.isArray(valuation.historical_valuation)
    ? valuation.historical_valuation.map(record)
    : []
  const latest = history
    .filter((row) => Number.isInteger(number(row.year)))
    .sort((a, b) => number(b.year)! - number(a.year)!)[0]
  const pe = number(latest?.pe)
  const pb = number(latest?.pb)
  if (pe === null || pb === null) {
    throw new SectorsError(
      'Data P/E dan P/B periode terbaru belum lengkap. Analisis tidak disimpan.',
    )
  }

  let risk = 40
  const reasons: string[] = []
  if (pe > 40) {
    risk += 25
    reasons.push(`P/E tinggi (${pe.toFixed(2)}x).`)
  } else if (pe < 0) {
    risk += 15
    reasons.push(`P/E negatif (${pe.toFixed(2)}x).`)
  }
  if (pb > 10) {
    risk += 20
    reasons.push(`P/B tinggi (${pb.toFixed(2)}x).`)
  }
  if (!reasons.length) {
    risk = 20
    reasons.push('Tidak melewati ambang P/E dan P/B pada aturan penilaian ini.')
  }
  const status = risk > 80 ? 'CRITICAL' : risk > 60 ? 'HIGH' : risk > 40 ? 'WARNING' : 'NORMAL'
  const close = number(valuation.last_close_price)
  const change = number(valuation.daily_close_change)
  const closeDate =
    typeof valuation.latest_close_date === 'string' ? valuation.latest_close_date : 'tidak tersedia'
  reasons.push(
    `Valuasi ${latest.year}: P/E ${pe.toFixed(2)}x, P/B ${pb.toFixed(2)}x. Harga penutupan: ${closeDate}.`,
  )

  return {
    ticker,
    name:
      typeof data.company_name === 'string' && data.company_name.trim()
        ? data.company_name
        : ticker,
    risk,
    status,
    price:
      close === null ? 'N/A' : `Rp ${close.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`,
    change: change === null ? 'N/A' : `${change > 0 ? '+' : ''}${(change * 100).toFixed(2)}%`,
    volumeSpike: 'N/A',
    reason: reasons.join(' '),
  }
}

export interface FullIntelligenceResult {
  ticker: string
  name: string
  price: string
  change: string
  rawPrice: number | null
  rawChange: number | null
  priceDate: string
  volumeSpike: string
  volumeSpikeRatio: string
  risk: number // Fundamental Risk
  compositeScore: number // Unified Score 0-100
  status: 'CRITICAL' | 'HIGH' | 'WARNING' | 'NORMAL'
  reason: string
  bandarmology: BandarmologyAnalysis
  catalystDivergence: CatalystDivergence
  insiderMovement: InsiderMovementAnalysis
  newsImpact: GeminiNewsImpact | null
}

export function buildFullIntelligence(params: {
  ticker: string
  reportData: unknown
  dailyRows: DailyPriceRow[]
  brokerData: unknown
  brokerRegistry: Record<
    string,
    {
      code: string
      name: string
      is_foreign: boolean
      cohort: 'institutional' | 'retail' | 'mixed'
    }
  >
  newsItems: Array<{ title: string; body: string; timestamp?: string }>
  newsImpact: GeminiNewsImpact | null
  filings: InsiderFilingRow[]
}): FullIntelligenceResult {
  const {
    ticker,
    reportData,
    dailyRows,
    brokerData,
    brokerRegistry,
    newsItems,
    newsImpact,
    filings,
  } = params

  // 1. Fundamental
  const base = buildAnalysis(reportData, ticker)

  // 2. Daily Price & Volume
  let actualPrice = base.price
  let actualChange = base.change
  let priceDate = 'Valuasi'
  let rawClose: number | null = null
  let rawChangeFraction: number | null = null

  if (dailyRows && dailyRows.length > 0) {
    const sortedDaily = [...dailyRows].sort((a, b) => a.date.localeCompare(b.date))
    const latestDaily = sortedDaily[sortedDaily.length - 1]
    rawClose = latestDaily.close
    actualPrice = `Rp ${latestDaily.close.toLocaleString('id-ID')}`
    priceDate = latestDaily.date

    if (sortedDaily.length > 1) {
      const prevDaily = sortedDaily[sortedDaily.length - 2]
      if (prevDaily.close > 0) {
        rawChangeFraction = (latestDaily.close - prevDaily.close) / prevDaily.close
        const pct = (rawChangeFraction * 100).toFixed(2)
        actualChange = `${rawChangeFraction >= 0 ? '+' : ''}${pct}%`
      }
    }
  }

  // 3. Volume Spike
  const volumeResult = calculateVolumeSpike(dailyRows)

  // 4. Bandarmology
  let brokerRows: Array<{
    broker_code: string
    bval?: number
    sval?: number
    blot?: number
    slot?: number
    nval?: number
  }> = []
  let brokerDateStr = priceDate
  const brokerObj = record(brokerData)
  if (Array.isArray(brokerObj.data) && brokerObj.data.length > 0) {
    const latestDateEntry = brokerObj.data[brokerObj.data.length - 1]
    if (latestDateEntry && Array.isArray(latestDateEntry.summary)) {
      brokerRows = latestDateEntry.summary
      brokerDateStr = latestDateEntry.date ?? priceDate
    }
  }

  const bandarmology = analyzeBandarmology(brokerRows, brokerRegistry, rawClose, brokerDateStr)

  // 5. Catalyst Divergence
  const latestNews = newsItems[0]
  const catalystDivergence = detectCatalystDivergence(
    newsImpact,
    rawChangeFraction,
    latestNews?.timestamp,
  )

  // 6. Insider Movement
  const insiderMovement = analyzeInsiderMovement(filings, rawClose)

  // 7. Unified Composite Threat & Opportunity Score (0 - 100)
  // Fundamental risk weight: 25%
  // Bandarmology risk weight: 35% (Inverted: big accumulation = low risk / high opportunity, distribution = high risk)
  // Divergence threat weight: 25%
  // Insider risk weight: 15%
  const fundamentalRisk = base.risk
  const bandarRisk = 100 - bandarmology.bandarScore
  const divergenceRisk =
    catalystDivergence.status === 'DELAYED_SELL_OFF_RISK'
      ? 85
      : catalystDivergence.status === 'SLEEPING_GIANT'
        ? 20
        : 50
  const insiderRisk = insiderMovement.insiderRiskScore

  const compositeRisk = Math.round(
    fundamentalRisk * 0.25 + bandarRisk * 0.35 + divergenceRisk * 0.25 + insiderRisk * 0.15,
  )

  let status: FullIntelligenceResult['status'] = 'NORMAL'
  if (compositeRisk > 75 || insiderMovement.status === 'STEEP_DISCOUNT_DUMP') {
    status = 'CRITICAL'
  } else if (compositeRisk > 55 || bandarmology.status === 'BIG_DISTRIBUTION') {
    status = 'HIGH'
  } else if (compositeRisk > 40) {
    status = 'WARNING'
  } else {
    status = 'NORMAL'
  }

  // Composite reason explanation
  const detailedReasons: string[] = []
  if (catalystDivergence.status === 'SLEEPING_GIANT') {
    detailedReasons.push(
      '🚀 Peluang Katalis: Saham terindikasi Sleeping Giant (katalis besar belum direspons pasar).',
    )
  } else if (catalystDivergence.status === 'DELAYED_SELL_OFF_RISK') {
    detailedReasons.push('⚠️ Waspada Risiko: Berita negatif berat belum direspons pelemahan harga.')
  }

  if (bandarmology.status === 'BIG_ACCUMULATION') {
    detailedReasons.push(`Akumulasi masif bandar terdeteksi (CR3: ${bandarmology.cr3Buy}%).`)
  } else if (bandarmology.status === 'BIG_DISTRIBUTION') {
    detailedReasons.push(`Distribusi besar bandar terdeteksi (CR3 Jual: ${bandarmology.cr3Sell}%).`)
  }

  if (insiderMovement.status === 'STEEP_DISCOUNT_DUMP') {
    detailedReasons.push(
      '🚨 Transaksi insider aneh: Aksi jual dengan diskon ekstrem di bawah harga pasar.',
    )
  } else if (insiderMovement.status === 'AGGRESSIVE_BUY') {
    detailedReasons.push('💎 Pembelian agresif oleh orang dalam terdeteksi.')
  }

  detailedReasons.push(base.reason)

  return {
    ticker,
    name: base.name,
    price: actualPrice,
    change: actualChange,
    rawPrice: rawClose,
    rawChange: rawChangeFraction,
    priceDate,
    volumeSpike: volumeResult.formattedRatio,
    volumeSpikeRatio: volumeResult.formattedRatio,
    risk: base.risk,
    compositeScore: compositeRisk,
    status,
    reason: detailedReasons.join(' '),
    bandarmology,
    catalystDivergence,
    insiderMovement,
    newsImpact,
  }
}
