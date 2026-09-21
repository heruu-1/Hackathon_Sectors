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

export class SectorsProviderError extends Error {
  statusCode?: number
  code: string

  constructor(message: string, code = 'PROVIDER_ERROR', statusCode?: number) {
    super(message)
    this.name = 'SectorsProviderError'
    this.code = code
    this.statusCode = statusCode
  }
}

function validateKey(apiKey?: string): string {
  const key = apiKey?.trim() || process.env.SECTORS_API_KEY?.trim()
  if (!key || key === 'your_sectors_api_key_here') {
    throw new SectorsProviderError(
      'SECTORS_API_KEY belum diisi pada konfigurasi server.',
      'CONFIG_UNAVAILABLE',
      503,
    )
  }
  return key
}

async function requestSectors(
  url: string,
  key: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<unknown> {
  try {
    const response = await fetchFn(url, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
      redirect: 'error',
    })

    if (!response.ok) {
      const messages: Record<number, string> = {
        400: 'Kode saham atau parameter tidak valid.',
        401: 'API key Sectors tidak valid atau sudah kedaluwarsa.',
        403: 'API key tidak memiliki akses ke data ini. Periksa paket langganan Sectors Anda.',
        404: 'Data tidak ditemukan untuk kode saham ini.',
        429: 'Batas kuota Sectors tercapai. Tunggu beberapa saat.',
      }
      const message =
        messages[response.status] ??
        `Layanan data pasar bermasalah (HTTP ${response.status}). Coba lagi nanti.`
      throw new SectorsProviderError(message, 'PROVIDER_UNAVAILABLE', response.status)
    }

    return (await response.json()) as unknown
  } catch (err) {
    if (err instanceof SectorsProviderError) throw err
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new SectorsProviderError(
        'Sectors belum merespons dalam 10 detik.',
        'PROVIDER_TIMEOUT',
        504,
      )
    }
    throw new SectorsProviderError(
      'Tidak dapat terhubung ke penyedia data pasar atau membaca responsnya.',
      'PROVIDER_UNAVAILABLE',
      503,
    )
  }
}

export async function fetchCompanyValuation(
  ticker: string,
  apiKey?: string,
  fetchFn: typeof fetch = fetch,
): Promise<DataEnvelope<CompanyValuation>> {
  const cleanTicker = normalizeTicker(ticker)
  try {
    const key = validateKey(apiKey)
    const raw = (await requestSectors(
      `https://api.sectors.app/v2/company/report/${cleanTicker}/?sections=valuation`,
      key,
      fetchFn,
    )) as Record<string, unknown>

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
  daysBack = 30,
  fetchFn: typeof fetch = fetch,
): Promise<DataEnvelope<DailyPriceRow[]>> {
  const cleanTicker = normalizeTicker(ticker)
  try {
    const key = validateKey(apiKey)
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - daysBack * 86_400_000).toISOString().split('T')[0]

    const raw = (await requestSectors(
      `https://api.sectors.app/v2/daily/${cleanTicker}/?start=${startDate}&end=${endDate}`,
      key,
      fetchFn,
    )) as unknown

    if (!Array.isArray(raw)) {
      return createEmptyEnvelope('SECTORS', endDate, 'Tidak ada data harga harian.')
    }

    const rows: DailyPriceRow[] = raw
      .map((r: Record<string, unknown>) => ({
        symbol: cleanTicker,
        date: String(r.date ?? ''),
        close: Number(r.close ?? 0),
        open: Number.isFinite(Number(r.open)) ? Number(r.open) : null,
        high: Number.isFinite(Number(r.high)) ? Number(r.high) : null,
        low: Number.isFinite(Number(r.low)) ? Number(r.low) : null,
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
    const key = validateKey(apiKey)
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - daysBack * 86_400_000).toISOString().split('T')[0]

    const raw = (await requestSectors(
      `https://api.sectors.app/v2/broker-summary/${cleanTicker}/?start=${startDate}&end=${endDate}`,
      key,
      fetchFn,
    )) as Record<string, unknown>

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
    const key = validateKey(apiKey)
    const raw = (await requestSectors(
      'https://api.sectors.app/v2/brokers/',
      key,
      fetchFn,
    )) as unknown

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
    const key = validateKey(apiKey)
    const cleanTicker = ticker ? normalizeTicker(ticker) : undefined
    const param = cleanTicker
      ? `symbols=${cleanTicker}&limit=${limit}`
      : `extension=idx&limit=${limit}`

    const raw = (await requestSectors(
      `https://api.sectors.app/v2/news/?${param}`,
      key,
      fetchFn,
    )) as { results?: MarketNewsItem[] }

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
    const key = validateKey(apiKey)
    const cleanTicker = ticker ? normalizeTicker(ticker) : undefined
    const param = cleanTicker ? `symbol=${cleanTicker}&limit=${limit}` : `limit=${limit}`

    const raw = (await requestSectors(
      `https://api.sectors.app/v2/filings/?${param}`,
      key,
      fetchFn,
    )) as { results?: InsiderFilingRow[] }

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
