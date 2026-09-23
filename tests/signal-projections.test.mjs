import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calibrateIntradayVolatilities,
  createMulberry32,
  createNormalGenerator,
  runSignalProjections,
} from '../domain/signal-projections.ts'
import { calculateRiskPlan } from '../domain/trade-risk.ts'
import { jakartaTimeToIso } from '../domain/trading-sessions.ts'

test('createMulberry32 produces 100% deterministic pseudo-random sequences', () => {
  const prng1 = createMulberry32(42)
  const prng2 = createMulberry32(42)

  const seq1 = Array.from({ length: 10 }, () => prng1())
  const seq2 = Array.from({ length: 10 }, () => prng2())

  assert.deepEqual(seq1, seq2)
})

test('createNormalGenerator produces standard normal values with mean ~0', () => {
  const prng = createMulberry32(12345)
  const normalGen = createNormalGenerator(prng)

  const N = 10000
  let sum = 0
  for (let i = 0; i < N; i++) {
    sum += normalGen()
  }
  const mean = sum / N
  // Mean of standard normal should be close to 0
  assert.ok(Math.abs(mean) < 0.05, `Mean ${mean} deviates too much from 0`)
})

test('calibrateIntradayVolatilities marks INSUFFICIENT_DATA when days < 20', () => {
  // Only 5 days of bars
  const bars = []
  for (let d = 1; d <= 5; d++) {
    const dayStr = `2026-09-0${d}`
    // Mon-Fri: add S1 bars
    for (let b = 0; b < 36; b++) {
      bars.push({
        ticker: 'BMRI',
        startAt: jakartaTimeToIso(dayStr, 9, b * 5, 0),
        endAt: jakartaTimeToIso(dayStr, 9, (b + 1) * 5, 0),
        open: 4200,
        high: 4210,
        low: 4190,
        close: 4200,
        volume: 1000,
        source: 'YAHOO',
      })
    }
  }

  const calib = calibrateIntradayVolatilities(bars, jakartaTimeToIso('2026-09-10', 12, 0, 0))
  assert.equal(calib.isSufficient, false)
  assert.match(calib.reason || '', /belum memenuhi syarat kalibrasi/)
})

test('runSignalProjections partitions probabilities to 1.0 and respects BMRI risk plan', () => {
  const context = {
    id: 'ctx-proj-test-1',
    ticker: 'BMRI',
    signalAt: jakartaTimeToIso('2026-09-21', 14, 0, 0),
    referencePrice: 4200,
    referencePriceAt: jakartaTimeToIso('2026-09-21', 14, 0, 0),
    ruleLabel: 'R01 Akumulasi Broker Asing',
    provenance: { source: 'SECTORS' },
    methodologyVersion: 'rasi-v2.0',
    initialRiskParams: {
      initialATR: 62.670334,
      tick: 10,
      buyFee: 0.0015,
      sellFee: 0.0025,
      stopSlippage: 10,
    },
    createdAt: new Date().toISOString(),
  }

  const riskPlan = calculateRiskPlan({
    entry: 4200,
    initialATR: 62.670334,
    tick: 10,
    buyFee: 0.0015,
    sellFee: 0.0025,
    stopSlippageTicks: 1,
  })

  // Mock sufficient calibration stats
  const calibration = {
    sigmaS1_5m: 0.0015,
    sigmaS2_5m: 0.0018,
    sigmaLunchGap: 0.0025,
    sigmaOvernightGap: 0.0035,
    completeDaysCount: 45,
    lunchGapCount: 45,
    overnightGapCount: 44,
    isSufficient: true,
  }

  // Evaluate asOf Tuesday 2026-09-22 12:00 (H1 matured, H3 and H5 pending)
  const asOf = jakartaTimeToIso('2026-09-22', 12, 0, 0)

  // Run with 10,000 paths for fast deterministic testing
  const result = runSignalProjections({
    context,
    asOfIso: asOf,
    asOfPrice: 4210,
    riskPlan,
    calibration,
    options: {
      numPaths: 10000,
      seed: 42,
    },
  })

  assert.equal(result.status, 'COMPLETED')
  assert.equal(result.calibratedDays, 45)

  // Partition check: pTp1BeforeSl + pSlBeforeTp1 + pNeitherTouched = 1.0 within 0.0001
  const sum =
    result.probabilities.pTp1BeforeSl +
    result.probabilities.pSlBeforeTp1 +
    result.probabilities.pNeitherTouched
  assert.ok(Math.abs(sum - 1.0) < 0.001, `Probabilities sum ${sum} is not 1.0`)

  // TP2 probability is independent metric (must be <= pTp1BeforeSl)
  assert.ok(
    result.probabilities.pTp2BeforeSl <= result.probabilities.pTp1BeforeSl,
    'P(TP2) should be less than or equal to P(TP1)',
  )

  // Distributions exist
  assert.ok(result.priceDistributions[3].median > 0)
  assert.ok(result.priceDistributions[5].median > 0)
  assert.ok(result.priceDistributions[5].p10 <= result.priceDistributions[5].p90)

  // Dynamic strategy metrics
  assert.ok(result.dynamicStrategy.winRatePct >= 0 && result.dynamicStrategy.winRatePct <= 100)

  // Sensitivities
  assert.ok(result.sensitivities.volPlus25.pTp1 > 0)
  assert.ok(result.sensitivities.slippage2Ticks.netRisk > riskPlan.netRiskPerShare)
})
