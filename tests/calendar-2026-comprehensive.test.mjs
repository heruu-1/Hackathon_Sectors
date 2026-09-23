import assert from 'node:assert/strict'
import test from 'node:test'

import { buildRemainingSimulationSteps } from '../domain/signal-projections.ts'
import { getNextTradingDay, isTradingDay, jakartaTimeToIso } from '../domain/trading-sessions.ts'
import idxCalendar from '../lib/data/idx-calendar-2026.json' with { type: 'json' }
import {
  evaluateSignalAnalysis,
  validateSignalContextMatch,
} from '../lib/server/services/signal-analysis.ts'

test('E2: Official IDX/KSEI calendar 2026 includes all required holidays and announcement reference', () => {
  assert.match(
    idxCalendar.source,
    /Peng-00041\/KSEI\/DIR\/0126/,
    'Calendar source must cite official KSEI announcement',
  )
  assert.match(idxCalendar.source, /SKB 3 Menteri/, 'Calendar source must cite SKB 3 Menteri')

  const requiredHolidays = [
    { date: '2026-03-18', name: 'Cuti Bersama Hari Suci Nyepi' },
    { date: '2026-05-15', name: 'Cuti Bersama Kenaikan Yesus Kristus' },
    { date: '2026-05-28', name: 'Cuti Bersama Hari Raya Idul Adha 1447 H' },
    { date: '2026-12-24', name: 'Cuti Bersama Hari Raya Natal' },
  ]

  for (const req of requiredHolidays) {
    const found = idxCalendar.holidays.find((h) => h.date === req.date)
    assert.ok(found, `Holiday ${req.date} (${req.name}) must exist in idx-calendar-2026.json`)
    assert.equal(found.name, req.name)

    const check = isTradingDay(req.date)
    assert.equal(check.isTrading, false, `${req.date} must not be a trading day`)
    assert.equal(check.calendarAvailable, true, `${req.date} calendar must be available`)
    assert.match(check.reason || '', new RegExp(req.name))
  }
})

test('E2: getNextTradingDay properly navigates complex holiday clusters in March 2026', () => {
  // Tuesday 2026-03-17 followed by:
  // - Wed 2026-03-18: Cuti Bersama Nyepi
  // - Thu 2026-03-19: Hari Suci Nyepi
  // - Fri 2026-03-20: Hari Raya Idul Fitri
  // - Sat 2026-03-21: Weekend
  // - Sun 2026-03-22: Weekend
  // - Mon 2026-03-23: Cuti Bersama Idul Fitri
  // - Tue 2026-03-24: Cuti Bersama Idul Fitri
  // Next trading day must be Wednesday 2026-03-25!
  const next = getNextTradingDay('2026-03-17')
  assert.equal(next.calendarAvailable, true)
  assert.equal(next.nextDate, '2026-03-25')
})

test('E3: buildRemainingSimulationSteps slices historical 5m bars when asOf is mid-session', () => {
  const signalAt = jakartaTimeToIso('2026-09-21', 9, 0, 0) // Mon S1 start
  const mockContext = {
    id: 'ctx-timeline-1',
    ticker: 'BBCA',
    signalAt,
    referencePrice: 10000,
    referencePriceAt: signalAt,
    ruleLabel: 'Test',
    provenance: { source: 'SECTORS' },
    methodologyVersion: 'rasi-v2.0',
    initialRiskParams: {
      initialATR: 150,
      tick: 25,
      buyFee: 0.0015,
      sellFee: 0.0025,
      stopSlippage: 25,
    },
    createdAt: signalAt,
  }

  const volatilities = {
    sigmaS1_5m: 0.001,
    sigmaS2_5m: 0.0012,
    sigmaLunchGap: 0.002,
    sigmaOvernightGap: 0.003,
  }

  // Case 1: asOf at 14:00 (mid-session of Monday S2, 6 bars elapsed out of 28)
  const asOfMidS2 = jakartaTimeToIso('2026-09-21', 14, 0, 0)
  const resMid = buildRemainingSimulationSteps({
    context: mockContext,
    asOfIso: asOfMidS2,
    volatilities,
  })

  // First step must NOT be lunch_gap because market has already opened S2 at 13:30
  assert.equal(resMid.steps[0].type, '5m')
  assert.equal(resMid.steps[0].session, 'S2')

  // Find index of first horizon boundary (Horizon 1 = Mon S2 end)
  const h1Idx = resMid.steps.findIndex((s) => s.isHorizonBoundary === 1)
  assert.ok(h1Idx >= 0, 'Horizon 1 boundary must exist')
  // Horizon 1 must have exactly 22 bars (28 total - 6 elapsed = 22 bars)
  const h1Bars = resMid.steps.slice(0, h1Idx + 1).filter((s) => s.type === '5m')
  assert.equal(h1Bars.length, 22, 'Mon S2 must have exactly 22 remaining bars after 14:00')

  // Case 2: asOf at 12:30 (during lunch break before S2 opens)
  const asOfLunch = jakartaTimeToIso('2026-09-21', 12, 30, 0)
  const resLunch = buildRemainingSimulationSteps({
    context: mockContext,
    asOfIso: asOfLunch,
    volatilities,
  })

  // First step MUST be lunch_gap because market has not yet opened for S2
  assert.equal(resLunch.steps[0].type, 'lunch_gap')
  assert.equal(resLunch.steps[0].session, 'S2')

  // Horizon 1 must have all 28 bars for Mon S2
  const h1LunchIdx = resLunch.steps.findIndex((s) => s.isHorizonBoundary === 1)
  const h1LunchBars = resLunch.steps.slice(0, h1LunchIdx + 1).filter((s) => s.type === '5m')
  assert.equal(h1LunchBars.length, 28, 'Mon S2 must have all 28 bars when evaluated during lunch')
})

test('E1: validateSignalContextMatch validates ticker match and handles whitespace/JK suffix', () => {
  const mockContext = {
    id: 'ctx-1',
    ticker: 'BBCA',
    signalAt: new Date().toISOString(),
    referencePrice: 10000,
    referencePriceAt: new Date().toISOString(),
    ruleLabel: 'Test',
    provenance: { source: 'SECTORS' },
    methodologyVersion: 'rasi-v2.0',
    initialRiskParams: {
      initialATR: 150,
      tick: 25,
      buyFee: 0.0015,
      sellFee: 0.0025,
      stopSlippage: 25,
    },
    createdAt: new Date().toISOString(),
  }

  // Matches exact, lowercase, whitespace, and .JK
  assert.doesNotThrow(() => validateSignalContextMatch(mockContext, 'BBCA'))
  assert.doesNotThrow(() => validateSignalContextMatch(mockContext, 'bbca'))
  assert.doesNotThrow(() => validateSignalContextMatch(mockContext, ' bbca.jk '))
  assert.doesNotThrow(() => validateSignalContextMatch(mockContext, 'BBCA.JK'))

  // Rejects mismatch
  assert.throws(
    () => validateSignalContextMatch(mockContext, 'BBRI'),
    /Signal context ticker mismatch: context=BBCA, request=BBRI/,
  )
  assert.throws(
    () => validateSignalContextMatch(mockContext, 'TLKM.JK'),
    /Signal context ticker mismatch: context=BBCA, request=TLKM/,
  )
})

test('E1: evaluateSignalAnalysis validates context existence when contextId is specified', async () => {
  const origFlag = process.env.SIGNAL_ANALYSIS_ENABLED
  process.env.SIGNAL_ANALYSIS_ENABLED = 'true'

  try {
    await assert.rejects(async () => {
      await evaluateSignalAnalysis({
        ticker: 'BBCA',
        contextId: 'ctx-does-not-exist',
      })
    }, /Signal context tidak ditemukan: ctx-does-not-exist/)
  } finally {
    process.env.SIGNAL_ANALYSIS_ENABLED = origFlag
  }
})
