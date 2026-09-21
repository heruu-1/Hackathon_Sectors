export type DataState = 'ready' | 'partial' | 'empty' | 'unavailable' | 'error'

export type DataSource = 'SECTORS' | 'GEMINI' | 'RULE_BASED' | 'RASI'

export type DataFreshness = 'fresh' | 'stale' | 'unknown'

export interface DataIssue {
  code: string
  message: string
}

export interface DataEnvelope<T> {
  state: DataState
  data: T | null
  source: DataSource
  fetchedAt: string | null
  sourceDate: string | null
  periodStart: string | null
  periodEnd: string | null
  freshness: DataFreshness
  issues: DataIssue[]
}

export function createEnvelope<T>(params: {
  state: DataState
  data: T | null
  source: DataSource
  fetchedAt?: string | null
  sourceDate?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  freshness?: DataFreshness
  issues?: DataIssue[]
}): DataEnvelope<T> {
  return {
    state: params.state,
    data: params.data,
    source: params.source,
    fetchedAt: params.fetchedAt ?? new Date().toISOString(),
    sourceDate: params.sourceDate ?? null,
    periodStart: params.periodStart ?? null,
    periodEnd: params.periodEnd ?? null,
    freshness: params.freshness ?? 'fresh',
    issues: params.issues ?? [],
  }
}

export function createEmptyEnvelope<T>(
  source: DataSource,
  sourceDate?: string | null,
  message = 'Tidak ada data yang ditemukan.',
): DataEnvelope<T> {
  return createEnvelope<T>({
    state: 'empty',
    data: null,
    source,
    sourceDate: sourceDate ?? null,
    issues: [{ code: 'NO_RECORDS', message }],
  })
}

export function createErrorEnvelope<T>(
  source: DataSource,
  message: string,
  code = 'FETCH_ERROR',
): DataEnvelope<T> {
  return createEnvelope<T>({
    state: 'error',
    data: null,
    source,
    issues: [{ code, message }],
  })
}

export interface HistoricalValuation {
  year: number
  pe: number | null
  pb: number | null
}

export interface CompanyValuation {
  symbol: string
  companyName: string
  lastClosePrice: number | null
  latestCloseDate: string | null
  dailyCloseChange: number | null
  historicalValuation: HistoricalValuation[]
}

export interface DailyPriceRow {
  symbol: string
  date: string
  close: number
  open?: number | null
  high?: number | null
  low?: number | null
  volume: number
  marketCap?: number | null
}

export interface BrokerRow {
  broker_code: string
  bfreq?: number
  blot?: number
  bval?: number
  bavg_per_share?: number
  sfreq?: number
  slot?: number
  sval?: number
  savg_per_share?: number
  nlot?: number
  nval?: number
  navg_per_share?: number
  f_bval?: number
  f_sval?: number
  f_blot?: number
  f_slot?: number
}

export interface BrokerSummaryEntry {
  date: string
  summary: BrokerRow[]
}

export interface BrokerSummaryData {
  symbol: string
  data: BrokerSummaryEntry[]
}

export interface BrokerRegistryEntry {
  code: string
  name: string
  is_foreign: boolean
  cohort: 'institutional' | 'retail' | 'mixed' | 'unknown'
}

export interface MarketNewsItem {
  title: string
  body: string
  source: string
  timestamp: string
  symbols?: string[]
}

export interface InsiderFilingRow {
  title?: string
  body?: string
  source?: string
  timestamp?: string
  sector?: string
  sub_sector?: string
  tags?: string[]
  symbol?: string
  transaction_type?: 'buy' | 'sell' | string
  holder_type?: string
  holder_name?: string
  holding_before?: number
  holding_after?: number
  amount_transaction?: number
  price?: number | null
  transaction_value?: number | null
  share_percentage_before?: number | null
  share_percentage_after?: number | null
  share_percentage_transaction?: number | null
  idx_investor_slug?: string
  idx_conglomerates_group_slug?: string
}
