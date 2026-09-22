import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateMedian,
  calculateMidRankPercentile,
  compareTargetWithPeers,
  evaluateMetricRank,
} from '../domain/peer-comparison.ts'

test('calculateMedian computes median for odd, even, and empty arrays', () => {
  assert.equal(calculateMedian([]), null)
  assert.equal(calculateMedian([10]), 10)
  assert.equal(calculateMedian([10, 20, 30]), 20)
  assert.equal(calculateMedian([30, 10, 20]), 20) // unsorted
  assert.equal(calculateMedian([10, 20, 30, 40]), 25)
})

test('calculateMidRankPercentile handles ranks and ties correctly', () => {
  // [10, 20, 30, 40] (n=4):
  // 10 -> (1 - 0.5) / 4 * 100 = 12.5%
  // 40 -> (4 - 0.5) / 4 * 100 = 87.5%
  assert.equal(calculateMidRankPercentile(10, [10, 20, 30, 40]), 12.5)
  assert.equal(calculateMidRankPercentile(40, [10, 20, 30, 40]), 87.5)

  // Ties: [10, 20, 20, 30] (n=4)
  // For 20: rankStart = 2, count = 2 -> midRank = 2 + 0.5 = 2.5
  // percentile = (2.5 - 0.5) / 4 * 100 = 50.0%
  assert.equal(calculateMidRankPercentile(20, [10, 20, 20, 30]), 50)
})

test('evaluateMetricRank handles negative PE and negative PB safely', () => {
  const peers = [10, 15, 20, 25, 30]

  // Negative PE
  const negPeRank = evaluateMetricRank(-5, peers, 'PE')
  assert.equal(negPeRank.status, 'NEGATIVE_EARNINGS')
  assert.equal(negPeRank.percentile, null)
  assert.equal(negPeRank.summaryLabel, 'P/E Negatif (Merugi)')

  // Negative PB
  const negPbRank = evaluateMetricRank(-1.2, peers, 'PB')
  assert.equal(negPbRank.status, 'NEGATIVE_EQUITY')
  assert.equal(negPbRank.percentile, null)
  assert.equal(negPbRank.summaryLabel, 'P/B Negatif (Defisiensi Modal)')

  // Valid discount PE: target 10 vs peers [10, 15, 20, 25, 30] (median 20)
  // diff = 10 - 20 = -10, relativeDiff = -50% -> DISCOUNT
  const discountPe = evaluateMetricRank(10, peers, 'PE')
  assert.equal(discountPe.status, 'DISCOUNT')
  assert.equal(discountPe.diffFromMedian, -10)
  assert.equal(discountPe.summaryLabel, 'Diskon 50% vs median')
})

test('compareTargetWithPeers falls back from subsector to sector when peers < 5', () => {
  const target = {
    symbol: 'BBCA',
    sector: 'Financials',
    sub_sector: 'Banks',
    pe: 12,
    pb: 2.2,
    net_income_growth_yoy: 0.15,
  }

  // Only 2 peers in same subsector, but 5 peers in same sector
  const candidatePeers = [
    { symbol: 'BBRI', sector: 'Financials', sub_sector: 'Banks', pe: 11, pb: 2.0 },
    { symbol: 'BMRI', sector: 'Financials', sub_sector: 'Banks', pe: 10, pb: 1.8 },
    { symbol: 'ADMF', sector: 'Financials', sub_sector: 'Financing', pe: 8, pb: 1.2 },
    { symbol: 'BFIN', sector: 'Financials', sub_sector: 'Financing', pe: 9, pb: 1.5 },
    { symbol: 'CFIN', sector: 'Financials', sub_sector: 'Financing', pe: 7, pb: 0.8 },
  ]

  const result = compareTargetWithPeers(target, candidatePeers)
  assert.equal(result.peerGroupType, 'SECTOR')
  assert.equal(result.isSampleSufficient, true)
  assert.equal(result.totalPeersEvaluated, 5)
  assert.equal(result.ruleR06.triggered, false)
})

test('compareTargetWithPeers triggers R06 when valuation is cheap but growth is negative', () => {
  const target = {
    symbol: 'UNTR',
    sector: 'Industrials',
    sub_sector: 'Heavy Machinery',
    pe: 5, // Very cheap
    pb: 0.8,
    net_income_growth_yoy: -0.25, // Deteriorating profit YoY
  }

  const candidatePeers = [
    { symbol: 'HEXA', sector: 'Industrials', sub_sector: 'Heavy Machinery', pe: 9, pb: 1.5 },
    { symbol: 'KOBX', sector: 'Industrials', sub_sector: 'Heavy Machinery', pe: 10, pb: 1.2 },
    { symbol: 'ITMG', sector: 'Industrials', sub_sector: 'Heavy Machinery', pe: 8, pb: 1.4 },
    { symbol: 'PTBA', sector: 'Industrials', sub_sector: 'Heavy Machinery', pe: 8.5, pb: 1.3 },
    { symbol: 'ADRO', sector: 'Industrials', sub_sector: 'Heavy Machinery', pe: 7.5, pb: 1.1 },
  ]

  const result = compareTargetWithPeers(target, candidatePeers)
  assert.equal(result.peerGroupType, 'SUB_SECTOR')
  assert.equal(result.ruleR06.triggered, true)
  assert.ok(result.ruleR06.explanation.includes('tampak murah'))
})
