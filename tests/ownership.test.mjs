import assert from 'node:assert/strict'
import test from 'node:test'

import {
  analyzeMonthlyOwnership,
  analyzeOwnership,
  calculatePercentagePointShift,
  normalizeOwnershipPercentage,
} from '../domain/ownership.ts'

test('normalizeOwnershipPercentage detects anomalies and bounds', () => {
  assert.deepEqual(normalizeOwnershipPercentage(15.4), { value: 15.4, isAnomaly: false })
  assert.deepEqual(normalizeOwnershipPercentage(105.2), { value: 105.2, isAnomaly: true })
  assert.deepEqual(normalizeOwnershipPercentage(-3.5), { value: -3.5, isAnomaly: true })
  assert.deepEqual(normalizeOwnershipPercentage(null), { value: null, isAnomaly: false })
})

test('calculatePercentagePointShift computes delta in percentage points', () => {
  // Current 60.5%, Previous 58.0% -> +2.5 pp
  assert.equal(calculatePercentagePointShift(60.5, 58.0), 2.5)
  // Current 39.5%, Previous 42.0% -> -2.5 pp
  assert.equal(calculatePercentagePointShift(39.5, 42.0), -2.5)
  assert.equal(calculatePercentagePointShift(null, 50), null)
})

test('analyzeMonthlyOwnership evaluates shifts between two consecutive months', () => {
  const reports = [
    {
      period: '2024-08',
      totalShareholders: 26500,
      totalShares: 10000000000,
      scriptlessShares: 3000000000,
      freeFloatPct: 30.0,
      localPct: 62.5,
      foreignPct: 37.5,
    },
    {
      period: '2024-07',
      totalShareholders: 25000,
      totalShares: 10000000000,
      scriptlessShares: 2950000000,
      freeFloatPct: 29.5,
      localPct: 60.0,
      foreignPct: 40.0,
    },
  ]

  const shift = analyzeMonthlyOwnership(reports)
  assert.ok(shift)
  assert.equal(shift.currentPeriod, '2024-08')
  assert.equal(shift.previousPeriod, '2024-07')
  assert.equal(shift.localShiftPoints, 2.5) // +2.5 pp
  assert.equal(shift.foreignShiftPoints, -2.5) // -2.5 pp
  assert.equal(shift.shareholderCountDiff, 1500) // +1,500 investors
  assert.equal(shift.freeFloatShiftPoints, 0.5)
  assert.ok(shift.summary.includes('Porsi investor lokal bertambah +2.5 pp'))
  assert.ok(shift.summary.includes('1.500 investor'))
})

test('analyzeOwnership integrates top holders, float anomaly flag, and insider filings', () => {
  const topShareholders = [
    {
      name: 'PT Dwimuria Investama Andalan',
      shares: 67729700000,
      percentage: 54.94,
      isController: true,
    },
    { name: 'Masyarakat / Publik', shares: 55530300000, percentage: 45.06, isController: false },
  ]

  const monthlyReports = [
    {
      period: '2024-08',
      totalShareholders: 350000,
      totalShares: 123260000000,
      scriptlessShares: 55530300000,
      freeFloatPct: 45.06,
      localPct: 68.0,
      foreignPct: 32.0,
      categories: [
        {
          code: 'ID',
          name: 'Individu',
          localShares: 20000000000,
          localPct: 16.2,
          foreignShares: 1000000000,
          foreignPct: 0.8,
          totalPct: 17.0,
        },
      ],
    },
  ]

  const insiderFilings = [
    {
      symbol: 'BBCA',
      holder_name: 'Jahja Setiaatmadja',
      transaction_type: 'buy',
      amount_transaction: 100000,
      price: 10200,
      transaction_value: 1020000000,
      timestamp: '2024-08-15T09:30:00Z',
    },
  ]

  const result = analyzeOwnership('BBCA', topShareholders, monthlyReports, insiderFilings, 10300)
  assert.equal(result.symbol, 'BBCA')
  assert.equal(result.totalControllingPct, 54.94)
  assert.equal(result.freeFloat.percentage, 45.06)
  assert.equal(result.freeFloat.isAnomaly, false)
  assert.equal(result.currentComposition?.period, '2024-08')
  assert.ok(result.insiderMovement)
  assert.equal(result.insiderMovement?.hasInsiderActivity, true)
})
