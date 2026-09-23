import crypto from 'node:crypto'

import {
  assessSignalConditions,
  calculateEMA20,
  calculateRVOL,
  calculateVWAP,
  calculateWilderATR,
} from '../../../domain/signal-indicators.ts'
import { evaluateSessionSignalOutcomes } from '../../../domain/signal-outcomes.ts'
import {
  DEFAULT_SIMULATION_MAX_PATHS,
  PRNG_VERSION,
  calibrateIntradayVolatilities,
  runSignalProjections,
} from '../../../domain/signal-projections.ts'
import { calculateRiskPlan, getIdxTickSize } from '../../../domain/trade-risk.ts'
import type {
  SignalAnalysisReport,
  SignalContext,
  SignalDataQuality,
  SignalModelParams,
} from '../../contracts/signal-analysis.ts'
import { isFeatureEnabled } from '../env.ts'
import { fetchIntradayPrices } from '../providers/intraday.ts'
import { fetchDailyPrices } from '../providers/sectors.ts'
import {
  getExactSignalAnalysisRun,
  getLatestSignalAnalysisRunForContext,
  getLatestSignalContextForTicker,
  getSignalContextById,
  saveSignalAnalysisRun,
  saveSignalContext,
} from '../repositories/signal-analysis.ts'

export const METHODOLOGY_VERSION = 'rasi-v2.0'

function computeConfigHash(context: SignalContext): string {
  const payload = JSON.stringify({
    methodology: METHODOLOGY_VERSION,
    params: context.initialRiskParams,
    refPrice: context.referencePrice,
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}

/**
 * Reads the latest saved signal analysis report without triggering network fetches or simulations.
 */
export async function getSignalAnalysisReport(
  ticker: string,
): Promise<SignalAnalysisReport | null> {
  const cleanTicker = ticker.trim().toUpperCase()
  const context = await getLatestSignalContextForTicker(cleanTicker)
  if (!context) return null

  return getLatestSignalAnalysisRunForContext(context.id)
}

export function validateSignalContextMatch(context: SignalContext, ticker: string): void {
  const cleanTicker = ticker.trim().toUpperCase().replace(/\.JK$/, '')
  if (context.ticker !== cleanTicker) {
    throw new Error(
      `Signal context ticker mismatch: context=${context.ticker}, request=${cleanTicker}`,
    )
  }
}

/**
 * Creates or retrieves a context, fetches intraday data, evaluates outcomes,
 * calculates indicators and risk plan, runs Monte Carlo projection, and persists the run.
 */
export async function evaluateSignalAnalysis(params: {
  ticker: string
  contextId?: string
}): Promise<SignalAnalysisReport> {
  if (!isFeatureEnabled('SIGNAL_ANALYSIS_ENABLED')) {
    throw new Error('Fitur evaluasi sinyal saat ini dinonaktifkan.')
  }

  const cleanTicker = params.ticker.trim().toUpperCase().replace(/\.JK$/, '')

  // 1. Resolve or create signal context
  let context: SignalContext | null = null

  if (params.contextId) {
    context = await getSignalContextById(params.contextId)
    if (!context) {
      throw new Error(`Signal context tidak ditemukan: ${params.contextId}`)
    }
    validateSignalContextMatch(context, cleanTicker)
  } else {
    // Check if an existing context for this ticker exists
    context = await getLatestSignalContextForTicker(cleanTicker)

    if (!context) {
      // Create new immutable signal context
      // Fetch recent intraday or daily prices for reference baseline
      const intradayRes = await fetchIntradayPrices(cleanTicker)
      const validBars = intradayRes.data ?? []

      let refPrice = 0
      let refPriceAt = new Date().toISOString()
      let initialATR = 0
      let provenanceSource: 'YAHOO' | 'sectors-daily' = 'YAHOO'

      if (validBars.length > 0) {
        const lastBar = validBars[validBars.length - 1]
        refPrice = lastBar.close
        refPriceAt = lastBar.endAt

        const atrRes = calculateWilderATR(validBars, 14)
        if (atrRes.isValid) {
          initialATR = Number(atrRes.atr.toFixed(4))
        }
      }

      // If initial ATR couldn't be calculated from intraday, use daily prices
      if (refPrice === 0 || initialATR === 0) {
        const dailyEnvelope = await fetchDailyPrices(cleanTicker, undefined, 30)
        const dailyRows = dailyEnvelope.data ?? []
        if (dailyRows.length > 0) {
          provenanceSource = 'sectors-daily'
          const sorted = [...dailyRows].sort((a, b) => a.date.localeCompare(b.date))
          const latestDaily = sorted[sorted.length - 1]
          if (refPrice === 0) {
            refPrice = latestDaily.close
            refPriceAt = new Date(latestDaily.date).toISOString()
          }

          if (initialATR === 0 && sorted.length >= 15) {
            // Compute real Wilder ATR across daily closing/high/low
            const dailyTrs: number[] = []
            for (let i = 1; i < sorted.length; i++) {
              const cur = sorted[i]
              const prev = sorted[i - 1]
              const curHigh = cur.high ?? cur.close
              const curLow = cur.low ?? cur.close
              const tr = Math.max(
                curHigh - curLow,
                Math.abs(curHigh - prev.close),
                Math.abs(curLow - prev.close),
              )
              dailyTrs.push(tr)
            }
            if (dailyTrs.length >= 14) {
              let atr = dailyTrs.slice(0, 14).reduce((sum, val) => sum + val, 0) / 14
              for (let i = 14; i < dailyTrs.length; i++) {
                atr = (atr * 13 + dailyTrs[i]) / 14
              }
              initialATR = Number(atr.toFixed(4))
            }
          }
        }
      }

      if (refPrice <= 0) {
        throw new Error(
          `Tidak dapat menentukan harga acuan untuk ${cleanTicker}. Pastikan data saham tersedia.`,
        )
      }

      if (initialATR <= 0) {
        throw new Error(
          `INSUFFICIENT_DATA: Riwayat harga ${cleanTicker} tidak mencukupi untuk menghitung ATR (minimal 15 bar diperlukan).`,
        )
      }

      const tick = getIdxTickSize(refPrice)
      const nowIso = new Date().toISOString()

      context = {
        id: crypto.randomUUID ? crypto.randomUUID() : `ctx-${cleanTicker}-${Date.now()}`,
        ticker: cleanTicker,
        signalAt: nowIso,
        referencePrice: refPrice,
        referencePriceAt: refPriceAt,
        ruleLabel: 'Analisis umum',
        provenance: {
          source: provenanceSource,
          details: { createdAutomatically: true },
        },
        methodologyVersion: METHODOLOGY_VERSION,
        initialRiskParams: {
          initialATR,
          tick,
          buyFee: 0.0015,
          sellFee: 0.0025,
          stopSlippage: tick,
        },
        createdAt: nowIso,
      }

      // Save new context to DB
      try {
        await saveSignalContext(context)
      } catch (err) {
        // If DB fails, log but do not mask
        console.warn('Gagal menyimpan signal context ke DB:', err)
      }
    }
  }

  // 2. Fetch fresh intraday bars from provider
  const intradayEnvelope = await fetchIntradayPrices(cleanTicker)
  const bars = intradayEnvelope.data ?? []

  const asOfIso = bars.length > 0 ? bars[bars.length - 1].endAt : new Date().toISOString()
  const asOfPrice = bars.length > 0 ? bars[bars.length - 1].close : context.referencePrice

  const configHash = computeConfigHash(context)

  // 3. Check for exact cached run
  try {
    const cachedRun = await getExactSignalAnalysisRun({
      contextId: context.id,
      asOf: asOfIso,
      methodologyVersion: METHODOLOGY_VERSION,
      configHash,
    })
    if (cachedRun) {
      return cachedRun
    }
  } catch {
    // Proceed if lookup fails
  }

  // 4. Calculate Risk Plan (Pure Domain)
  const riskPlan = calculateRiskPlan({
    entry: context.referencePrice,
    initialATR: context.initialRiskParams.initialATR,
    tick: context.initialRiskParams.tick,
    buyFee: context.initialRiskParams.buyFee,
    sellFee: context.initialRiskParams.sellFee,
    stopSlippageTicks: 1,
  })

  // 5. Evaluate Actual Session Outcomes (Pure Domain)
  const outcomes = evaluateSessionSignalOutcomes({
    context,
    bars,
    asOfIso,
    feedDelayMinutes: 10,
  })

  // 6. Calculate Technical Indicators & Conditions
  // Daily closes for EMA-20
  let ema20: number | null = null
  try {
    const dailyEnvelope = await fetchDailyPrices(cleanTicker, undefined, 40)
    const dailyRows = dailyEnvelope.data ?? []
    if (dailyRows.length >= 20) {
      const sorted = [...dailyRows].sort((a, b) => a.date.localeCompare(b.date))
      ema20 = calculateEMA20(sorted.map((r) => r.close))
    }
  } catch {
    // Optional
  }

  // VWAP & RVOL calculated per continuous session / day
  const latestBar = bars.length > 0 ? bars[bars.length - 1] : null
  const latestDateStr = latestBar ? latestBar.startAt.slice(0, 10) : ''
  const currentSessionBars = latestDateStr
    ? bars.filter((b) => b.startAt.startsWith(latestDateStr))
    : []

  const vwap = calculateVWAP(currentSessionBars.length > 0 ? currentSessionBars : bars)

  let rvol: number | null = null
  if (bars.length > 0 && latestDateStr) {
    const volumeByDay = new Map<string, number>()
    for (const b of bars) {
      const day = b.startAt.slice(0, 10)
      volumeByDay.set(day, (volumeByDay.get(day) ?? 0) + b.volume)
    }
    const currentDayVolume = volumeByDay.get(latestDateStr) ?? 0
    const historicalDayVolumes = Array.from(volumeByDay.entries())
      .filter(([day]) => day !== latestDateStr)
      .map(([, vol]) => vol)
    rvol = calculateRVOL(currentDayVolume, historicalDayVolumes)
  }

  const barsSinceSignal = bars.filter((b) => b.startAt >= context.signalAt)
  const assessment = assessSignalConditions({
    currentPrice: asOfPrice,
    referencePrice: context.referencePrice,
    vwap,
    ema20,
    rvol,
    stopLoss: riskPlan.stopLoss,
    barsSinceSignal,
  })

  // 7. Calibrate & Run Stochastic Projections
  const calibration = calibrateIntradayVolatilities(bars, asOfIso)
  const maxPaths = Math.min(
    Number(process.env.SIMULATION_MAX_PATHS) || DEFAULT_SIMULATION_MAX_PATHS,
    DEFAULT_SIMULATION_MAX_PATHS,
  )
  const projection = runSignalProjections({
    context,
    asOfIso,
    asOfPrice,
    riskPlan,
    calibration,
    options: {
      numPaths: maxPaths,
      seed: 42,
    },
  })

  // Data Quality & Model Params
  const dataQuality: SignalDataQuality = {
    totalBars: bars.length,
    missingBars: 0,
    delayMinutes: 10,
    issues: intradayEnvelope.issues.map((i) => `${i.code}: ${i.message}`),
  }

  const modelParams: SignalModelParams = {
    numPaths: maxPaths,
    seed: 42,
    resolution: '5m',
    prngVersion: PRNG_VERSION,
  }

  // Checksum calculation
  const reportPayloadString = JSON.stringify({
    contextId: context.id,
    asOf: asOfIso,
    outcomes,
    riskPlan,
    projectionStatus: projection.status,
  })
  const checksum = crypto.createHash('sha256').update(reportPayloadString).digest('hex')

  const report: SignalAnalysisReport = {
    context,
    asOf: asOfIso,
    outcomes,
    assessment,
    riskPlan,
    projection,
    dataQuality,
    modelParams,
    checksum,
  }

  // 8. Persist Run to Database
  const runStatus = projection.status === 'COMPLETED' ? 'completed' : 'partial'
  try {
    await saveSignalAnalysisRun({
      contextId: context.id,
      asOf: asOfIso,
      methodologyVersion: METHODOLOGY_VERSION,
      configHash,
      dataChecksum: checksum,
      report,
      status: runStatus,
    })
  } catch (err) {
    console.warn('Gagal menyimpan signal analysis run ke DB:', err)
  }

  return report
}
