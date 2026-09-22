import { selectCandidates } from '../../../domain/discovery.ts'
import {
  type RuleEvaluationResult,
  evaluateAllEvidenceRules,
} from '../../../domain/evidence-rules.ts'
import { analyzeBrokers } from '../../../domain/flows.ts'
import { normalizePriceSeries } from '../../../domain/normalization.ts'
import {
  calculateHistoricalVolatility,
  calculateMaxDrawdown,
  calculateRelativeVolume,
} from '../../../domain/relative-strength.ts'
import { type Result, errorResult, successResult } from '../../contracts/result.ts'
import { getOrSetCache } from '../cache.ts'
import {
  fetchBrokerSummary,
  fetchDailyPrices,
  fetchInsiderFilings,
  fetchUniverseCompanies,
} from '../providers/sectors.ts'
import { requestSectorsShared } from '../providers/transport.ts'
import { insertResearchSnapshot } from '../repositories/research-snapshots.ts'

export interface CandidateRadarCase {
  ticker: string
  companyName: string
  reasonsForRadar: string[]
  rulesMatched: RuleEvaluationResult[]
  conflictingEvidence: string[]
  alignedEvidence: string[]
  missingData: string[]
  observationPeriod: {
    start: string | null
    end: string | null
  }
  nextResearchSteps: string[]
}

export interface MarketScanResult {
  scanId: string
  marketCutoffDate: string
  candidates: string[]
  radarCases: CandidateRadarCase[]
  coverage: {
    totalUniverse: number
    candidatesEvaluated: number
  }
}

export async function runMarketScanService(options?: {
  cutoffDate?: string
  forceRefresh?: boolean
}): Promise<Result<MarketScanResult>> {
  const cutoff = options?.cutoffDate || new Date().toISOString().split('T')[0]
  const cacheKey = `market_scan:${cutoff}`

  try {
    const scanResult = await getOrSetCache<MarketScanResult>(
      cacheKey,
      24 * 60 * 60 * 1000,
      async () => {
        // 1. Discovery: Get universe and candidates
        const companies = await fetchUniverseCompanies(200, {
          forceRefresh: options?.forceRefresh,
        })

        // Extract price movers
        const priceMovers = companies
          .filter((c) => c.daily_close_change !== null && c.daily_close_change !== undefined)
          .map((c) => ({
            symbol: c.symbol?.replace(/\.JK$/i, '') ?? '',
            absoluteChange: Math.abs(c.daily_close_change ?? 0),
          }))

        // Fetch recent news for publication movers
        const rawNews = await requestSectorsShared<{
          results?: Array<{
            symbol?: string
            symbols?: string[]
            timestamp?: string
          }>
        }>('https://api.sectors.app/v2/news/?extension=idx&limit=30', {
          capabilityId: 'market_news',
        })

        const newsList = rawNews?.results ?? []
        const publications: Array<{ symbol: string; timestamp: string }> = []
        for (const item of newsList) {
          const syms = item.symbols ?? (item.symbol ? [item.symbol] : [])
          for (const s of syms) {
            publications.push({
              symbol: s.replace(/\.JK$/i, ''),
              timestamp: item.timestamp ?? new Date().toISOString(),
            })
          }
        }

        // Select candidates (up to 8)
        const candidateTickers = selectCandidates(
          {
            priceMovers,
            publications,
          },
          8,
        )

        // 2. Deep analysis for each candidate concurrently
        const radarCases: CandidateRadarCase[] = await Promise.all(
          candidateTickers.map(async (ticker) => {
            const company = companies.find((c) => c.symbol?.replace(/\.JK$/i, '') === ticker)
            const companyName = company?.company_name ?? ticker

            // Fetch prices, flows, filings concurrently
            const [pricesEnv, brokersEnv, filingsEnv] = await Promise.all([
              fetchDailyPrices(ticker, undefined, 30),
              fetchBrokerSummary(ticker, undefined, 10),
              fetchInsiderFilings(ticker, undefined, 5),
            ])

            const priceSeries = normalizePriceSeries(pricesEnv.data ?? [])
            const rvol = calculateRelativeVolume(priceSeries)
            const volatility = calculateHistoricalVolatility(priceSeries, 20)
            const drawdown = calculateMaxDrawdown(priceSeries)

            // 5-session return
            let return5: number | null = null
            if (priceSeries.length >= 6) {
              const curr = priceSeries[priceSeries.length - 1].close
              const past = priceSeries[priceSeries.length - 6].close
              return5 = past > 0 ? curr / past - 1 : null
            }

            // Broker & Flow analysis
            const rawBrokerRows = (brokersEnv.data?.data ?? []).flatMap((entry) =>
              entry.summary.map((r) => ({
                broker_code: r.broker_code,
                buy_volume: (r.blot ?? 0) * 100,
                buy_value: r.bval ?? 0,
                sell_volume: (r.slot ?? 0) * 100,
                sell_value: r.sval ?? 0,
                net_volume: (r.nlot ?? 0) * 100,
                net_value: r.nval ?? (r.bval ?? 0) - (r.sval ?? 0),
              })),
            )
            const brokerAnalysis = analyzeBrokers(rawBrokerRows)

            let netForeign5 = 0
            for (const entry of brokersEnv.data?.data ?? []) {
              for (const r of entry.summary) {
                netForeign5 += (r.f_bval ?? 0) - (r.f_sval ?? 0)
              }
            }

            const hasFilings = (filingsEnv.data?.length ?? 0) > 0

            // Evaluate deterministic rules
            const evaluatedRules = evaluateAllEvidenceRules({
              priceReturn5Sessions: return5,
              netForeignFlow5Sessions: netForeign5,
              relativeVolume20: rvol,
              filingsCount: filingsEnv.data?.length ?? 0,
              hasClassifiableFiling: hasFilings,
            })

            const trueRules = evaluatedRules.filter((r) => r.status === 'EVALUATED_TRUE')
            const conflicting = trueRules
              .filter((r) => r.evidenceDirection === 'CONFLICTING')
              .map((r) => r.description)
            const aligned = trueRules
              .filter((r) => r.evidenceDirection === 'ALIGNED')
              .map((r) => r.description)
            const missing = evaluatedRules
              .filter((r) => r.status === 'NOT_EVALUABLE')
              .flatMap((r) => r.missingData ?? [])

            const reasons = trueRules.map((r) => r.title)
            if (reasons.length === 0) {
              reasons.push('Kandidat terpilih dari pemindaian volatilitas pasar')
            }

            const radarCase: CandidateRadarCase = {
              ticker,
              companyName,
              reasonsForRadar: reasons,
              rulesMatched: trueRules,
              conflictingEvidence: conflicting,
              alignedEvidence: aligned,
              missingData: Array.from(new Set(missing)),
              observationPeriod: {
                start: priceSeries[0]?.date ?? null,
                end: priceSeries[priceSeries.length - 1]?.date ?? null,
              },
              nextResearchSteps: [
                `Periksa laporan keuangan kuartalan ${ticker}`,
                `Bandingkan valuasi dengan kelompok sejenis di sektor ${company?.sector ?? 'terkait'}`,
                `Tinjau komposisi pemegang saham dan free float`,
              ],
            }

            // Persist research snapshot asynchronously
            void insertResearchSnapshot({
              ticker,
              companyName,
              schemaVersion: '1.0.0',
              ruleVersion: 'rasi-mi-v2',
              marketCutoffDate: cutoff,
              payload: {
                radarCase,
                priceSeries,
                brokerAnalysis,
                rvol,
                volatility,
                drawdown,
              },
            }).catch(() => {})

            return radarCase
          }),
        )

        return {
          scanId: crypto.randomUUID(),
          marketCutoffDate: cutoff,
          candidates: candidateTickers,
          radarCases,
          coverage: {
            totalUniverse: companies.length,
            candidatesEvaluated: candidateTickers.length,
          },
        }
      },
      { forceRefresh: options?.forceRefresh },
    )

    return successResult(scanResult)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menjalankan pemindaian pasar.'
    return errorResult('PROVIDER_UNAVAILABLE', message)
  }
}
