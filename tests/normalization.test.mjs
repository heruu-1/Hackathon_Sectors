import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateNSessionReturn,
  calculatePercentagePoints,
  lotsToShares,
  normalizePriceSeries,
  parseNumberOrNull,
  parseTradingDate,
  sharesToLots,
} from '../domain/normalization.ts'

test('parseTradingDate parses valid formats and rejects invalid ones', () => {
  assert.equal(parseTradingDate('2026-09-22'), '2026-09-22')
  assert.equal(parseTradingDate('2026-09-22T07:00:00Z'), '2026-09-22')
  assert.equal(parseTradingDate('22-09-2026'), null)
  assert.equal(parseTradingDate(null), null)
})

test('parseNumberOrNull distinguishes zero from null/empty', () => {
  assert.equal(parseNumberOrNull(0), 0)
  assert.equal(parseNumberOrNull('0'), 0)
  assert.equal(parseNumberOrNull(null), null)
  assert.equal(parseNumberOrNull(''), null)
  assert.equal(parseNumberOrNull(undefined), null)
  assert.equal(parseNumberOrNull('abc'), null)
})

test('sharesToLots and lotsToShares convert accurately', () => {
  assert.equal(sharesToLots(150), 1)
  assert.equal(sharesToLots(200), 2)
  assert.equal(lotsToShares(2), 200)
})

test('normalizePriceSeries sorts chronologically regardless of input order', () => {
  const shuffled = [
    { date: '2026-09-20', close: 100, volume: 1000 },
    { date: '2026-09-22', close: 110, volume: 2000 },
    { date: '2026-09-19', close: 95, volume: 500 },
    { date: '2026-09-21', close: 105, volume: 1500 },
  ]

  const normalized = normalizePriceSeries(shuffled)
  assert.equal(normalized.length, 4)
  assert.equal(normalized[0].date, '2026-09-19')
  assert.equal(normalized[1].date, '2026-09-20')
  assert.equal(normalized[2].date, '2026-09-21')
  assert.equal(normalized[3].date, '2026-09-22')
  assert.equal(normalized[3].close, 110)
  assert.equal(normalized[3].lotVolume, 20)
})

test('calculateNSessionReturn calculates returns and requires N+1 sessions', () => {
  const series = [
    {
      date: '2026-09-19',
      close: 100,
      volume: 1000,
      lotVolume: 10,
      open: null,
      high: null,
      low: null,
      marketCap: null,
    },
    {
      date: '2026-09-20',
      close: 105,
      volume: 1000,
      lotVolume: 10,
      open: null,
      high: null,
      low: null,
      marketCap: null,
    },
    {
      date: '2026-09-21',
      close: 110,
      volume: 1000,
      lotVolume: 10,
      open: null,
      high: null,
      low: null,
      marketCap: null,
    },
  ]

  // 1-session return: (110 / 105) - 1
  const ret1 = calculateNSessionReturn(series, 1)
  assert.ok(ret1 !== null)
  assert.ok(Math.abs(ret1 - (110 / 105 - 1)) < 1e-6)

  // 2-session return: (110 / 100) - 1 = 0.1
  const ret2 = calculateNSessionReturn(series, 2)
  assert.ok(ret2 !== null)
  assert.ok(Math.abs(ret2 - 0.1) < 1e-6)

  // 3-session return: Not enough observations (needs 4, only 3 available)
  const ret3 = calculateNSessionReturn(series, 3)
  assert.equal(ret3, null)
})

test('calculatePercentagePoints calculates difference in percentage points', () => {
  assert.equal(calculatePercentagePoints(0.155, 0.102), 5.3)
  assert.equal(calculatePercentagePoints(null, 0.1), null)
})
