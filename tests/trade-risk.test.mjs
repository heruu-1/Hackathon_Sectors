import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculatePositionSize,
  calculateRiskPlan,
  calculateTrailingStop,
  ceilToTick,
  floorToTick,
  getIdxTickSize,
} from '../domain/trade-risk.ts'

test('getIdxTickSize conforms to IDX price fractions', () => {
  assert.equal(getIdxTickSize(50), 1)
  assert.equal(getIdxTickSize(199), 1)
  assert.equal(getIdxTickSize(200), 2)
  assert.equal(getIdxTickSize(498), 2)
  assert.equal(getIdxTickSize(500), 5)
  assert.equal(getIdxTickSize(1995), 5)
  assert.equal(getIdxTickSize(2000), 10)
  assert.equal(getIdxTickSize(4990), 10)
  assert.equal(getIdxTickSize(5000), 25)
  assert.equal(getIdxTickSize(15000), 25)
})

test('floorToTick and ceilToTick round properly', () => {
  assert.equal(floorToTick(4105.99, 10), 4100)
  assert.equal(ceilToTick(4375.39, 10), 4380)
  assert.equal(ceilToTick(4226.84, 10), 4230)
  assert.equal(ceilToTick(4470.526, 10), 4480)
})

test('BMRI exact arithmetic fixture validation (1-tick slippage)', () => {
  const plan = calculateRiskPlan({
    entry: 4200,
    initialATR: 62.670334,
    tick: 10,
    buyFee: 0.0015,
    sellFee: 0.0025,
    stopSlippageTicks: 1,
  })

  // Biaya entry: 4.206,30
  assert.equal(plan.costBasis, 4206.3)

  // SL: 4.100
  assert.equal(plan.stopLoss, 4100)

  // Eksekusi stop asumsi: 4.090
  assert.equal(plan.assumedStopExecution, 4090)

  // Risiko bersih per saham: 126,525
  assert.equal(plan.netRiskPerShare, 126.525)

  // TP1 limit: 4.380
  assert.equal(plan.takeProfit1, 4380)

  // TP2 limit: 4.480
  assert.equal(plan.takeProfit2, 4480)

  // BEP dengan slippage: 4.230
  assert.equal(plan.breakEvenPrice, 4230)

  // RRR post-fee
  assert.ok(plan.rrrTP1 >= 1.25)
  assert.ok(plan.rrrTP2 >= 2.0)

  // Position sizing: Rp100 juta modal, 0.5% risk
  const sizing = calculatePositionSize({
    capital: 100000000,
    costBasis: plan.costBasis,
    netRiskPerShare: plan.netRiskPerShare,
    maxRiskFraction: 0.005,
  })

  // Lot: 39
  assert.equal(sizing.totalLots, 39)
  // Pembagian TP1/sisa: 19/20 lot
  assert.equal(sizing.tp1Lots, 19)
  assert.equal(sizing.tp2Lots, 20)
})

test('BMRI exact arithmetic fixture validation (2-tick sensitivity)', () => {
  const plan2 = calculateRiskPlan({
    entry: 4200,
    initialATR: 62.670334,
    tick: 10,
    buyFee: 0.0015,
    sellFee: 0.0025,
    stopSlippageTicks: 2, // 2 ticks = 20
  })

  // Risiko bersih: 136,50
  assert.equal(plan2.netRiskPerShare, 136.5)

  // TP1: 4.390
  assert.equal(plan2.takeProfit1, 4390)

  // TP2: 4.500
  assert.equal(plan2.takeProfit2, 4500)

  // BEP: 4.240
  assert.equal(plan2.breakEvenPrice, 4240)

  // Position sizing: 36 lot
  const sizing2 = calculatePositionSize({
    capital: 100000000,
    costBasis: plan2.costBasis,
    netRiskPerShare: plan2.netRiskPerShare,
    maxRiskFraction: 0.005,
  })
  assert.equal(sizing2.totalLots, 36)

  // Profit pada TP2 Rp4.500 adalah Rp282,45
  const profitTP2 = Number((4500 * (1 - 0.0025) - plan2.costBasis).toFixed(2))
  assert.equal(profitTP2, 282.45)

  // Surplus BEP dengan eksekusi Rp4.220 adalah Rp3,15
  const bepSurplus = Number((4220 * (1 - 0.0025) - plan2.costBasis).toFixed(2))
  assert.equal(bepSurplus, 3.15)
})

test('calculateTrailingStop maintains ratchet property (never drops below previous stop or BEP)', () => {
  const initialStop = 4100
  const bep = 4230
  const atr = 60
  const tick = 10

  // Post-TP1 price rises to 4350: candidate = floorToTick(4350 - 60) = 4290
  // trailing = max(4100, 4230, 4290) = 4290
  const step1 = calculateTrailingStop({
    previousStop: initialStop,
    breakEvenPrice: bep,
    highestCompleted15mCloseSinceTP1: 4350,
    initialATR: atr,
    tick,
  })
  assert.equal(step1, 4290)

  // If price subsequently drops to 4300, trailing stop does NOT drop below step1 (4290)
  const step2 = calculateTrailingStop({
    previousStop: step1,
    breakEvenPrice: bep,
    highestCompleted15mCloseSinceTP1: 4300,
    initialATR: atr,
    tick,
  })
  assert.equal(step2, 4290)
})
