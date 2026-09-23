import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateMaxDrawdown,
  calculateRelativeStrength,
  calculateRelativeVolume,
} from '../domain/relative-strength.ts'

test('calculateRelativeStrength aligns dates between stock and benchmark', () => {
  const stock = [
    {
      date: '2026-09-01',
      close: 100,
      volume: 1000,
      lotVolume: 10,
      open: null,
      high: null,
      low: null,
      marketCap: null,
    },
    {
      date: '2026-09-02',
      close: 105,
      volume: 1000,
      lotVolume: 10,
      open: null,
      high: null,
      low: null,
      marketCap: null,
    },
    {
      date: '2026-09-03',
      close: 110,
      volume: 1000,
      lotVolume: 10,
      open: null,
      high: null,
      low: null,
      marketCap: null,
    },
  ]
  const bench = [
    {
      date: '2026-09-01',
      close: 7000,
      volume: 1000,
      lotVolume: 10,
      open: null,
      high: null,
      low: null,
      marketCap: null,
    },
    {
      date: '2026-09-02',
      close: 7070,
      volume: 1000,
      lotVolume: 10,
      open: null,
      high: null,
      low: null,
      marketCap: null,
    },
    {
      date: '2026-09-03',
      close: 7140,
      volume: 1000,
      lotVolume: 10,
      open: null,
      high: null,
      low: null,
      marketCap: null,
    },
  ]

  // 2-session:
  // stock: 110/100 - 1 = 0.10 (10%)
  // bench: 7140/7000 - 1 = 0.02 (2%)
  // RS = 0.10 - 0.02 = 0.08 (8%)
  const rs = calculateRelativeStrength(stock, bench, 2)
  assert.equal(rs.stockReturn, 0.1)
  assert.equal(rs.benchmarkReturn, 0.02)
  assert.equal(rs.relativeStrength, 0.08)
  assert.equal(rs.sessionsUsed, 2)
  assert.equal(rs.startDate, '2026-09-01')
  assert.equal(rs.endDate, '2026-09-03')
})

test('calculateRelativeVolume requires 21 observations', () => {
  const shortSeries = Array.from({ length: 20 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    close: 100,
    volume: 1000,
    lotVolume: 10,
    open: null,
    high: null,
    low: null,
    marketCap: null,
  }))
  assert.equal(calculateRelativeVolume(shortSeries), null)

  const fullSeries = Array.from({ length: 21 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    close: 100,
    volume: i === 20 ? 3000 : 1000, // 20 sessions at 1000, 21st session at 3000 -> 3.0x
    lotVolume: 10,
    open: null,
    high: null,
    low: null,
    marketCap: null,
  }))
  assert.equal(calculateRelativeVolume(fullSeries), 3.0)
})

test('calculateMaxDrawdown calculates maximum decline from peak', () => {
  const series = [
    {
      date: '2026-09-01',
      close: 100,
      volume: 1000,
      lotVolume: 10,
      open: null,
      high: null,
      low: null,
      marketCap: null,
    },
    {
      date: '2026-09-02',
      close: 120,
      volume: 1000,
      lotVolume: 10,
      open: null,
      high: null,
      low: null,
      marketCap: null,
    }, // Peak
    {
      date: '2026-09-03',
      close: 90,
      volume: 1000,
      lotVolume: 10,
      open: null,
      high: null,
      low: null,
      marketCap: null,
    }, // (90 - 120) / 120 = -0.25
    {
      date: '2026-09-04',
      close: 110,
      volume: 1000,
      lotVolume: 10,
      open: null,
      high: null,
      low: null,
      marketCap: null,
    },
  ]
  assert.equal(calculateMaxDrawdown(series), -0.25)
})
