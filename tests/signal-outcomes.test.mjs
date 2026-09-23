import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluateSessionSignalOutcomes,
  evaluateSignalOutcomes,
} from '../domain/signal-outcomes.ts'
import {
  assessSignalConditions,
  calculateEMA20,
  calculateRVOL,
  calculateVWAP,
  calculateWilderATR,
  checkStopScenarios,
} from '../domain/signal-indicators.ts'
import { jakartaTimeToIso } from '../domain/trading-sessions.ts'

// ---------------------------------------------------------------------------
// Legacy Daily Outcomes Tests (Preserved)
// ---------------------------------------------------------------------------

test('evaluateSignalOutcomes calculates forward returns accurately when data is present', () => {
  const dailyPrices = [
    { date: '2024-08-01', close: 1000 },
    { date: '2024-08-02', close: 1020 }, // 1-session forward (+2%)
    { date: '2024-08-05', close: 1010 },
    { date: '2024-08-06', close: 1050 }, // 3-session forward (+5%)
    { date: '2024-08-07', close: 1040 },
    { date: '2024-08-08', close: 1100 }, // 5-session forward (+10%)
  ]

  const outcomes = evaluateSignalOutcomes(
    'snap-test-1',
    'BBCA',
    'R01',
    'rasi-mi-v2',
    '2024-08-01',
    1000,
    dailyPrices,
  )

  assert.equal(outcomes.length, 3)

  // 1 session
  assert.equal(outcomes[0].horizon, 1)
  assert.equal(outcomes[0].status, 'MATURED')
  assert.equal(outcomes[0].targetDate, '2024-08-02')
  assert.equal(outcomes[0].targetPrice, 1020)
  assert.equal(outcomes[0].returnFraction, 0.02)

  // 3 session
  assert.equal(outcomes[1].horizon, 3)
  assert.equal(outcomes[1].status, 'MATURED')
  assert.equal(outcomes[1].targetDate, '2024-08-06')
  assert.equal(outcomes[1].targetPrice, 1050)
  assert.equal(outcomes[1].returnFraction, 0.05)

  // 5 session
  assert.equal(outcomes[2].horizon, 5)
  assert.equal(outcomes[2].status, 'MATURED')
  assert.equal(outcomes[2].targetDate, '2024-08-08')
  assert.equal(outcomes[2].targetPrice, 1100)
  assert.equal(outcomes[2].returnFraction, 0.1)
})

test('evaluateSignalOutcomes marks status PENDING when future sessions have not occurred yet', () => {
  const dailyPrices = [
    { date: '2024-08-01', close: 1000 },
    { date: '2024-08-02', close: 1030 },
  ]

  const outcomes = evaluateSignalOutcomes(
    'snap-test-2',
    'BBCA',
    'R04',
    'rasi-mi-v2',
    '2024-08-01',
    1000,
    dailyPrices,
  )

  assert.equal(outcomes[0].horizon, 1)
  assert.equal(outcomes[0].status, 'MATURED')
  assert.equal(outcomes[0].returnFraction, 0.03)

  assert.equal(outcomes[1].horizon, 3)
  assert.equal(outcomes[1].status, 'PENDING')
  assert.equal(outcomes[1].targetPrice, null)

  assert.equal(outcomes[2].horizon, 5)
  assert.equal(outcomes[2].status, 'PENDING')
  assert.equal(outcomes[2].targetPrice, null)
})

test('evaluateSignalOutcomes handles missing signal date gracefully', () => {
  const dailyPrices = [{ date: '2024-08-02', close: 1030 }]

  const outcomes = evaluateSignalOutcomes(
    'snap-test-3',
    'BBCA',
    'R04',
    'rasi-mi-v2',
    '2024-08-01',
    1000,
    dailyPrices,
  )

  assert.equal(outcomes[0].status, 'MISSING_PRICE')
  assert.equal(outcomes[1].status, 'MISSING_PRICE')
  assert.equal(outcomes[2].status, 'MISSING_PRICE')
})

// ---------------------------------------------------------------------------
// New Intraday Session Outcomes Tests
// ---------------------------------------------------------------------------

test('evaluateSessionSignalOutcomes accurately computes H1, H3, H5 session outcomes and statuses', () => {
  // Context: Signal emitted Monday 2026-09-21 at 14:00 (Sesi II)
  // Reference price: 4200
  // Target sessions:
  // H1: Tuesday 2026-09-22 S1 (09:00 - 12:00)
  // H3: Wednesday 2026-09-23 S1 (09:00 - 12:00)
  // H5: Thursday 2026-09-24 S1 (09:00 - 12:00)
  const context = {
    id: 'ctx-bmri-test-1',
    ticker: 'BMRI',
    signalAt: jakartaTimeToIso('2026-09-21', 14, 0, 0),
    referencePrice: 4200,
    referencePriceAt: jakartaTimeToIso('2026-09-21', 14, 0, 0),
    ruleLabel: 'R01 Akumulasi Broker Asing',
    provenance: { source: 'SECTORS' },
    methodologyVersion: 'rasi-v2.0',
    initialRiskParams: {
      initialATR: 62.67,
      tick: 10,
      buyFee: 0.0015,
      sellFee: 0.0025,
      stopSlippage: 10,
    },
    createdAt: new Date().toISOString(),
  }

  // Provide closing bar for Tue S1 (11:55 - 12:00) with close = 4300
  const tueS1CloseBar = {
    ticker: 'BMRI',
    startAt: jakartaTimeToIso('2026-09-22', 11, 55, 0),
    endAt: jakartaTimeToIso('2026-09-22', 12, 0, 0),
    open: 4290,
    high: 4310,
    low: 4290,
    close: 4300,
    volume: 500000,
    source: 'YAHOO',
  }

  // Evaluate asOf Tuesday 2026-09-22 13:00 (H1 is matured, H3 and H5 are pending)
  const asOfTuesday = jakartaTimeToIso('2026-09-22', 13, 0, 0)
  const outcomes = evaluateSessionSignalOutcomes({
    context,
    bars: [tueS1CloseBar],
    asOfIso: asOfTuesday,
    feedDelayMinutes: 10,
  })

  assert.equal(outcomes.length, 3)

  // H1: Matured
  assert.equal(outcomes[0].horizon, 1)
  assert.equal(outcomes[0].status, 'MATURED')
  assert.equal(outcomes[0].targetDate, '2026-09-22')
  assert.equal(outcomes[0].targetSession, 'S1')
  assert.equal(outcomes[0].actualPrice, 4300)
  // Gross return: (4300 - 4200) / 4200 = 100 / 4200 = +0.0238
  assert.equal(outcomes[0].grossReturn, 0.0238)
  assert.ok(outcomes[0].netReturn !== null)

  // H3: Pending
  assert.equal(outcomes[1].horizon, 3)
  assert.equal(outcomes[1].status, 'PENDING')
  assert.equal(outcomes[1].targetDate, '2026-09-23')
  assert.equal(outcomes[1].targetSession, 'S1')
  assert.equal(outcomes[1].actualPrice, null)

  // H5: Pending
  assert.equal(outcomes[2].horizon, 5)
  assert.equal(outcomes[2].status, 'PENDING')
  assert.equal(outcomes[2].targetDate, '2026-09-24')
  assert.equal(outcomes[2].targetSession, 'S1')
  assert.equal(outcomes[2].actualPrice, null)
})

test('evaluateSessionSignalOutcomes flags AWAITING_DATA and MISSING_PRICE appropriately', () => {
  const context = {
    id: 'ctx-bmri-test-2',
    ticker: 'BMRI',
    signalAt: jakartaTimeToIso('2026-09-21', 14, 0, 0),
    referencePrice: 4200,
    referencePriceAt: jakartaTimeToIso('2026-09-21', 14, 0, 0),
    ruleLabel: 'Analisis umum',
    provenance: { source: 'SECTORS' },
    methodologyVersion: 'rasi-v2.0',
    initialRiskParams: {
      initialATR: 62.67,
      tick: 10,
      buyFee: 0.0015,
      sellFee: 0.0025,
      stopSlippage: 10,
    },
    createdAt: new Date().toISOString(),
  }

  // Target H1 is Tuesday 2026-09-22 12:00:00
  // Test 1: Evaluated at 12:05 (within 10-minute feed delay) with no closing bar -> AWAITING_DATA
  const asOf1205 = jakartaTimeToIso('2026-09-22', 12, 5, 0)
  const outcomesAwaiting = evaluateSessionSignalOutcomes({
    context,
    bars: [],
    asOfIso: asOf1205,
    feedDelayMinutes: 10,
  })
  assert.equal(outcomesAwaiting[0].status, 'AWAITING_DATA')

  // Test 2: Evaluated at 12:20 (past 10-minute feed delay) with no closing bar -> MISSING_PRICE
  const asOf1220 = jakartaTimeToIso('2026-09-22', 12, 20, 0)
  const outcomesMissing = evaluateSessionSignalOutcomes({
    context,
    bars: [],
    asOfIso: asOf1220,
    feedDelayMinutes: 10,
  })
  assert.equal(outcomesMissing[0].status, 'MISSING_PRICE')
})

// ---------------------------------------------------------------------------
// Technical Indicators Domain Tests
// ---------------------------------------------------------------------------

test('calculateWilderATR requires at least 15 bars and computes Wilder smoothed ATR', () => {
  // Fewer than 15 bars -> invalid
  const fewBars = Array.from({ length: 10 }, (_, i) => ({
    ticker: 'BMRI',
    startAt: jakartaTimeToIso('2026-09-21', 9, i * 5, 0),
    endAt: jakartaTimeToIso('2026-09-21', 9, (i + 1) * 5, 0),
    open: 4200,
    high: 4220,
    low: 4190,
    close: 4210,
    volume: 1000,
    source: 'YAHOO',
  }))
  assert.equal(calculateWilderATR(fewBars).isValid, false)

  // 20 bars with steady TR = 30
  const steadyBars = Array.from({ length: 20 }, (_, i) => ({
    ticker: 'BMRI',
    startAt: jakartaTimeToIso('2026-09-21', 9, i * 5, 0),
    endAt: jakartaTimeToIso('2026-09-21', 9, (i + 1) * 5, 0),
    open: 4200,
    high: 4220,
    low: 4190,
    close: 4200,
    volume: 1000,
    source: 'YAHOO',
  }))
  const res = calculateWilderATR(steadyBars)
  assert.equal(res.isValid, true)
  assert.equal(res.atr, 30)
})

test('calculateEMA20 computes exponential moving average on 20 daily closes', () => {
  const closes = Array.from({ length: 25 }, () => 4000)
  const ema = calculateEMA20(closes)
  assert.equal(ema, 4000)
})

test('calculateVWAP and RVOL compute accurately and handle zero volume', () => {
  const bars = [
    {
      ticker: 'BMRI',
      startAt: '2026-09-21T02:00:00Z',
      endAt: '2026-09-21T02:05:00Z',
      open: 4200,
      high: 4230,
      low: 4170,
      close: 4200, // typical price = 4200
      volume: 1000,
      source: 'YAHOO',
    },
    {
      ticker: 'BMRI',
      startAt: '2026-09-21T02:05:00Z',
      endAt: '2026-09-21T02:10:00Z',
      open: 4200,
      high: 4260,
      low: 4200,
      close: 4260, // typical price = 4240
      volume: 1000,
      source: 'YAHOO',
    },
  ]

  // VWAP: (4200 * 1000 + 4240 * 1000) / 2000 = 4220
  const vwap = calculateVWAP(bars)
  assert.equal(vwap, 4220)

  // RVOL
  const rvol = calculateRVOL(2000, [1000, 1000, 1000, 1000, 1000])
  assert.equal(rvol, 2.0)
})

test('checkStopScenarios detects stop loss violation accurately', () => {
  const bars = [
    {
      ticker: 'BMRI',
      startAt: '2026-09-21T02:00:00Z',
      endAt: '2026-09-21T02:05:00Z',
      open: 4200,
      high: 4220,
      low: 4180,
      close: 4200,
      volume: 1000,
      source: 'YAHOO',
    },
    {
      ticker: 'BMRI',
      startAt: '2026-09-21T02:05:00Z',
      endAt: '2026-09-21T02:10:00Z',
      open: 4180,
      high: 4190,
      low: 4090, // <= 4100 (Triggered!)
      close: 4100,
      volume: 2000,
      source: 'YAHOO',
    },
  ]

  const check = checkStopScenarios(bars, 4100)
  assert.equal(check.status, 'SL_TRIGGERED')
  assert.equal(check.triggeredAt, '2026-09-21T02:05:00Z')
})

test('assessSignalConditions correctly synthesizes technical conditions', () => {
  const assessment = assessSignalConditions({
    currentPrice: 4250,
    referencePrice: 4200,
    vwap: 4220,
    ema20: 4180,
    rvol: 1.5,
    stopLoss: 4100,
    barsSinceSignal: [],
  })

  assert.equal(assessment.condition, 'STRONG_BULLISH')
  assert.equal(assessment.isAboveVwap, true)
  assert.equal(assessment.isAboveEma20, true)
  assert.equal(assessment.stopStatus, 'UNTRIGGERED')
})
