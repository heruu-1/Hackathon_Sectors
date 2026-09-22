import assert from 'node:assert/strict'
import test from 'node:test'

import { buildMarketOverview } from '../domain/market-overview.ts'
import { calculateMedian, summarizeSector } from '../domain/universe.ts'

test('calculateMedian handles odd and even arrays', () => {
  assert.equal(calculateMedian([1, 2, 3]), 2)
  assert.equal(calculateMedian([1, 2, 3, 4]), 2.5)
  assert.equal(calculateMedian([]), null)
})

test('summarizeSector counts advancing, declining, unchanged accurately', () => {
  const companies = [
    { symbol: 'BBCA', name: 'Bank Central Asia', sector: 'Finance', dailyChange: 0.02 },
    { symbol: 'BBRI', name: 'Bank Rakyat Indonesia', sector: 'Finance', dailyChange: -0.01 },
    { symbol: 'BMRI', name: 'Bank Mandiri', sector: 'Finance', dailyChange: 0.0 },
    { symbol: 'BBNI', name: 'Bank Negara Indonesia', sector: 'Finance', dailyChange: null },
  ]

  const summary = summarizeSector('Finance', companies)
  assert.equal(summary.sector, 'Finance')
  assert.equal(summary.totalCompanies, 4)
  assert.equal(summary.advancing, 1)
  assert.equal(summary.declining, 1)
  assert.equal(summary.unchanged, 1)
  assert.equal(summary.medianChangeFraction, 0.0)
})

test('buildMarketOverview aggregates market breadth and sorts sectors', () => {
  const companies = [
    {
      symbol: 'BBCA',
      name: 'Bank Central Asia',
      sector: 'Finance',
      dailyChange: 0.02,
      date: '2026-09-22',
    },
    {
      symbol: 'TLKM',
      name: 'Telkom Indonesia',
      sector: 'Technology',
      dailyChange: 0.05,
      date: '2026-09-22',
    },
    {
      symbol: 'ASII',
      name: 'Astra International',
      sector: 'Industrials',
      dailyChange: -0.03,
      date: '2026-09-22',
    },
  ]

  const overview = buildMarketOverview(companies, '2026-09-22')
  assert.equal(overview.breadth.advancing, 2)
  assert.equal(overview.breadth.declining, 1)
  assert.equal(overview.breadth.unchanged, 0)
  assert.equal(overview.breadth.totalMonitored, 3)
  assert.equal(overview.sectors.length, 3)
  // Tech has highest change (+0.05) so should be first
  assert.equal(overview.sectors[0].sector, 'Technology')
})
