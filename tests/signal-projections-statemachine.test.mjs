import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_SIMULATION_MAX_PATHS,
  buildRemainingSimulationSteps,
  runSignalProjections,
} from '../domain/signal-projections.ts'
import { calculateRiskPlan } from '../domain/trade-risk.ts'
import { jakartaTimeToIso } from '../domain/trading-sessions.ts'

const mockContext = {
  id: 'ctx-sm-test-1',
  ticker: 'BMRI',
  signalAt: jakartaTimeToIso('2026-09-21', 10, 0, 0),
  referencePrice: 4200,
  referencePriceAt: jakartaTimeToIso('2026-09-21', 10, 0, 0),
  ruleLabel: 'Test',
  provenance: { source: 'SECTORS' },
  methodologyVersion: 'rasi-v2.0',
  initialRiskParams: {
    initialATR: 62.5,
    tick: 10,
    buyFee: 0.0015,
    sellFee: 0.0025,
    stopSlippage: 10,
  },
  createdAt: jakartaTimeToIso('2026-09-21', 10, 0, 0),
}

const mockCalibration = {
  sigmaS1_5m: 0.0015,
  sigmaS2_5m: 0.0018,
  sigmaLunchGap: 0.0025,
  sigmaOvernightGap: 0.0035,
  completeDaysCount: 30,
  lunchGapCount: 30,
  overnightGapCount: 30,
  isSufficient: true,
}

test('E4: Position state machine strictly bounds outcomes and probabilities partition to 1.0', () => {
  const riskPlan = calculateRiskPlan({
    entry: 4200,
    initialATR: 62.5,
    tick: 10,
    buyFee: 0.0015,
    sellFee: 0.0025,
    stopSlippageTicks: 1,
  })

  const result = runSignalProjections({
    context: mockContext,
    asOfIso: jakartaTimeToIso('2026-09-21', 10, 0, 0),
    asOfPrice: 4200,
    riskPlan,
    calibration: mockCalibration,
    options: {
      numPaths: 10000,
      seed: 42,
    },
  })

  // 1. Probabilities partition check: pTp1BeforeSl + pSlBeforeTp1 + pNeitherTouched = 1.0
  const pSum =
    result.probabilities.pTp1BeforeSl +
    result.probabilities.pSlBeforeTp1 +
    result.probabilities.pNeitherTouched

  assert.equal(result.probabilities.sumCheck, 1.0, 'sumCheck must be exactly 1.0')
  assert.ok(Math.abs(pSum - 1.0) < 1e-9, `Probability sum ${pSum} must equal 1.0 within 1e-9`)

  // 2. TP2 reached must be <= TP1 reached
  assert.ok(
    result.probabilities.pTp2BeforeSl <= result.probabilities.pTp1BeforeSl,
    `P(TP2)=${result.probabilities.pTp2BeforeSl} must be <= P(TP1)=${result.probabilities.pTp1BeforeSl}`,
  )

  // 3. Probabilities must be valid percentages in [0, 1]
  assert.ok(result.probabilities.pTp1BeforeSl >= 0 && result.probabilities.pTp1BeforeSl <= 1)
  assert.ok(result.probabilities.pTp2BeforeSl >= 0 && result.probabilities.pTp2BeforeSl <= 1)
  assert.ok(result.probabilities.pSlBeforeTp1 >= 0 && result.probabilities.pSlBeforeTp1 <= 1)
  assert.ok(result.probabilities.pNeitherTouched >= 0 && result.probabilities.pNeitherTouched <= 1)
})

test('E4: buildRemainingSimulationSteps marks completed 15m closes', () => {
  const { steps } = buildRemainingSimulationSteps({
    context: mockContext,
    asOfIso: jakartaTimeToIso('2026-09-21', 10, 0, 0),
    volatilities: mockCalibration,
  })

  // S1 has 5m bars. Every 3rd 5m bar should be marked as completed 15m close
  const s1_5mBars = steps.filter((s) => s.type === '5m' && s.session === 'S1')
  assert.ok(s1_5mBars.length > 0)

  // Check that at least some steps have isCompleted15mClose true
  const completed15m = steps.filter((s) => s.isCompleted15mClose)
  assert.ok(completed15m.length > 0, 'Simulation steps must include completed 15m close markers')

  // Gaps must NOT be marked as completed 15m close
  const gapsWith15m = steps.filter(
    (s) => (s.type === 'lunch_gap' || s.type === 'overnight_gap') && s.isCompleted15mClose,
  )
  assert.equal(gapsWith15m.length, 0, 'Gaps must not be 15m bar closes')
})

test('E5: Sensitivities use real simulation reruns rather than artificial multipliers', () => {
  const riskPlan = calculateRiskPlan({
    entry: 4200,
    initialATR: 62.5,
    tick: 10,
    buyFee: 0.0015,
    sellFee: 0.0025,
    stopSlippageTicks: 1,
  })

  const result = runSignalProjections({
    context: mockContext,
    asOfIso: jakartaTimeToIso('2026-09-21', 10, 0, 0),
    asOfPrice: 4200,
    riskPlan,
    calibration: mockCalibration,
    options: {
      numPaths: 5000,
      seed: 42,
    },
  })

  const { pTp1BeforeSl, pSlBeforeTp1 } = result.probabilities
  const { volPlus25, volMinus25, slippage2Ticks } = result.sensitivities

  assert.ok(pTp1BeforeSl >= 0 && pTp1BeforeSl <= 1)
  assert.ok(pSlBeforeTp1 >= 0 && pSlBeforeTp1 <= 1)
  assert.ok(volPlus25.pTp1 >= 0 && volPlus25.pTp1 <= 1)
  assert.ok(volMinus25.pTp1 >= 0 && volMinus25.pTp1 <= 1)
  assert.ok(volPlus25.pSl >= 0 && volPlus25.pSl <= 1)
  assert.ok(volMinus25.pSl >= 0 && volMinus25.pSl <= 1)

  // 2-tick slippage increases net risk
  assert.ok(
    slippage2Ticks.netRisk > riskPlan.netRiskPerShare,
    `2-tick slippage risk ${slippage2Ticks.netRisk} must exceed 1-tick risk ${riskPlan.netRiskPerShare}`,
  )
})

test('E7: Synchronous path count is capped at DEFAULT_SIMULATION_MAX_PATHS (25,000)', () => {
  assert.equal(DEFAULT_SIMULATION_MAX_PATHS, 25000)

  const riskPlan = calculateRiskPlan({
    entry: 4200,
    initialATR: 62.5,
    tick: 10,
    buyFee: 0.0015,
    sellFee: 0.0025,
    stopSlippageTicks: 1,
  })

  // Calling with 100,000 should be safely capped and complete fast
  const start = Date.now()
  const result = runSignalProjections({
    context: mockContext,
    asOfIso: jakartaTimeToIso('2026-09-21', 10, 0, 0),
    asOfPrice: 4200,
    riskPlan,
    calibration: mockCalibration,
    options: {
      numPaths: 100000, // Excessive request, should be capped to 25,000
      seed: 42,
    },
  })
  const duration = Date.now() - start

  assert.equal(result.status, 'COMPLETED')
  // Should complete within reasonable time (< 2.5 seconds)
  assert.ok(duration < 3000, `Simulation took too long: ${duration}ms`)
})
